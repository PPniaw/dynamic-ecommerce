// Claude as the storefront's decision maker.
//
// Claude never writes copy. It returns a `Decision` (enums + product ids),
// enforced by structured outputs, so every response is schema-valid and
// can be rendered without a human reading it first.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import { ARCHETYPE_PRESETS } from "../../shared/archetypes.ts";
import { DecisionSchema, type Decision } from "../../shared/decision.ts";
import { chatPrompt, parseChatAnswer, type ChatContext, type ChatTurn } from "../../shared/chat.ts";
import type { DecisionInput } from "./types.ts";

const MODEL = process.env.SHOP_CLAUDE_MODEL ?? "claude-opus-5";
// This runs on every meaningful shopper action, so latency matters more than
// depth. `low` effort is the right trade for a ranking/layout call; raise it
// with SHOP_CLAUDE_EFFORT if the decisions look shallow.
const EFFORT = (process.env.SHOP_CLAUDE_EFFORT ?? "low") as "low" | "medium" | "high";

// Credentials resolve from ANTHROPIC_API_KEY (or an `ant auth login` profile).
const client = new Anthropic();

export const claudeEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

// Frozen: no timestamps or per-user data here, so the prefix stays cacheable.
// The presets are static data, so embedding them keeps it frozen.
const SYSTEM = `You are the merchandising brain of a live lifestyle shop (tableware, coffee & tea, scent, paper goods, home, everyday carry). You decide what kind of store each shopper walks into. You never write copy: every field is an enum or a product id, and all wording is rendered by the frontend from those enums.

Each request gives you one shopper's persona (MBTI, zodiac, traits, interests), their stated preferences and need, a behaviour profile, recently engaged products, their cart, and the live catalog. Prices and stock change every few seconds.

## The four archetypes
The top-level decision is the archetype: four structurally different stores, each a designed combination of theme, card, header, hero, section rhythm, listing page and product page.
- editorial (文藝收藏者): magazine spread, big photos, serif type, lots of white space, maker stories. For slow, sentimental, story-driven shoppers who buy things to keep: introverted feelers (INFx / ISFx), water signs, traits like 慢活 / 念舊 / 感性, interests like 閱讀 / 陶藝 / 茶 / 手沖咖啡 / 香氛.
- collage (熱情探險家): stickers, collage hero, marquee, rounded type, playful. For curious, impulsive, experience-seeking shoppers who like surprises: extroverted intuitives (ENxP), fire signs, traits like 好奇 / 衝動 / 愛冒險 / 外向, interests like 露營 / 音樂祭 / 攝影 / 植物.
- index (理性比較者): spec tables, numbered ledger, sharp corners, no decoration, high information density. For analytical shoppers who compare before buying and dislike ad-like pages: xNTJ / xSTJ thinkers, air signs, traits like 理性 / 重設計, interests like 鋼筆 / 手帳 / 設計.
- deal (務實比價者): countdown, big prices, dense grids, add-to-cart everywhere, dark utility look. For practical, time-pressed, price-driven shoppers: xSTJ / ESxx, earth signs, traits like 務實 / 比價 / 愛送禮, a budget cap, many clicks on discounted items, an urgent or gift need.

## Presets (JSON)
Start from the preset of the archetype you choose. Copy its theme, card, header, hero variant/headline, listing and product as-is; the section list starts as its "rhythm" (each rhythm entry becomes a section: add "category" and "productIds").
${JSON.stringify(ARCHETYPE_PRESETS)}

## How to decide
1. Archetype. If preferences.archetype is not "auto", use it. Otherwise weigh the persona (MBTI, zodiac element, traits, interests), the stated need, and behaviour (category affinity, dealClicks, budget, cart). Stated need and recent behaviour outrank astrology; zodiac is a light tie-breaker. With an empty persona and no behaviour, use editorial.
2. Deviate from the preset only with a concrete reason from this shopper's data, field by field (e.g. scheme "dark" for a 夜貓子; a gift_ideas rail when the need is a gift; a because_viewed rail after recent views; headline gift_season for a gift need). If preferences.scheme is not "auto", theme.scheme must equal it.
3. Sections: 3 to 7, in the order they should appear, most likely to convert first. Product counts per section: kind "rail" by layout — table 8, bento 7, dense 10, editorial 5, grid 8, carousel 8; kind "marquee" up to 10; kind "story" 3 (handmade / local makers); kinds "categories", "promo", "ticker" take no products ([]). category is a shop category only when intent is "category" (the rail then holds only that category), otherwise "none".
4. hero.productIds: spread 1, collage 4, ledger 0, flash 3, minimal 1.
5. highlights are recommendation badges only (for_you / trending / new), at most one per product; sale, low stock and sold out are computed by the store, don't badge them.
6. signals: the reason codes that actually drove this decision.

Rules: use only product ids from the catalog. Never feature a product with stock 0. Respect the budget (price <= budget) unless nothing fits. A stated need outranks inferred behaviour. Don't repeat a product across more than two sections.`;

function renderInput(i: DecisionInput): string {
  const catalog = i.products
    .map((p) => [
      p.id, p.name, p.maker, p.category, p.price, i.listPrices.get(p.id) ?? p.compareAt ?? p.price,
      p.stock, p.sold, p.tags.join(","), p.isNew ? "new" : "",
    ].join("|"))
    .join("\n");
  const { persona, ...prefs } = i.user.prefs;
  return [
    `trigger: ${i.trigger}`,
    `persona: ${JSON.stringify(persona)}`,
    `preferences: ${JSON.stringify(prefs)}`,
    `profile: ${JSON.stringify(i.profile)}`,
    `recently_engaged: ${i.recentIds.join(",") || "none"}`,
    `cart: ${i.cartIds.join(",") || "empty"}`,
    `catalog (id|name|maker|category|price|list_price|stock|sold|tags|new):\n${catalog}`,
  ].join("\n");
}

// Why not `betaZodOutputFormat`: the SDK's schema transform (sdk 0.128) keeps
// only `type` for strings and demotes `enum` to a description hint, so the
// enums would stop being constraints. Zod's own JSON Schema keeps `enum`,
// which structured outputs enforce. We then validate with the same Zod schema.
const { $schema: _drop, ...DECISION_JSON_SCHEMA } = z.toJSONSchema(DecisionSchema) as Record<string, unknown>;

export class ClaudeDecisionError extends Error {}

export async function decideWithClaude(input: DecisionInput): Promise<Decision> {
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    thinking: { type: "adaptive" },
    output_config: { effort: EFFORT, format: { type: "json_schema", schema: DECISION_JSON_SCHEMA } },
    // Server-side fallback: if the primary model declines, the API reroutes
    // inside the same call instead of failing the storefront.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    messages: [{ role: "user", content: renderInput(input) }],
  });

  if (res.stop_reason === "refusal") throw new ClaudeDecisionError(`refusal: ${res.stop_details?.category ?? "unknown"}`);
  if (res.stop_reason === "max_tokens") throw new ClaudeDecisionError("max_tokens");
  const text = res.content.find((b) => b.type === "text");
  if (!text) throw new ClaudeDecisionError("no text block");
  const parsed = DecisionSchema.safeParse(JSON.parse(text.text));
  if (!parsed.success) throw new ClaudeDecisionError(`schema: ${parsed.error.message}`);
  return parsed.data;
}

// ---- chat: read the message and reply in one call ----------------------------
// Same prompt as the published preview's `sample` path (shared/chat.ts), so
// both behave alike. The reply is short, so this stays on the fast settings.
export async function chatWithClaude(ctx: ChatContext, history: ChatTurn[], text: string) {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    output_config: { effort: "low" },
    messages: [{ role: "user", content: chatPrompt(ctx, history, text) }],
  });
  const out = res.content.find((b) => b.type === "text")?.text ?? "";
  const json = out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1);
  return parseChatAnswer(JSON.parse(json || "{}"));
}
