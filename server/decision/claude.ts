// Claude as the storefront's decision maker.
//
// Claude never writes copy. It returns a `Decision` (enums + product ids),
// enforced by structured outputs, so every response is schema-valid and
// can be rendered without a human reading it first.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import { DecisionSchema, type Decision } from "../../shared/decision.ts";
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
const SYSTEM = `You are the merchandising brain of a live e-commerce storefront.
Each request gives you one shopper's profile, stated preferences and needs, their recent activity, their cart, and the live catalog (price, base price, stock, units sold). Stock and prices change every few seconds.

Decide the storefront for this shopper right now:
- theme: pick colors, corner radius, density and font that fit this shopper's taste. Stated style (minimal / vivid / dark) is a hard constraint; "auto" means infer it from the tags they engage with.
- hero: the single product most worth their attention now, with the variant that explains why (deal, last_chance for stock <= 5, gift, restock_alert, new_arrival, spotlight).
- sections: 3 to 6 sections in the order they should appear, each with 3 to 8 product ids. Put the section most likely to convert first. Use category only for kind "category", otherwise "none".
- badges: at most one per product, only where true (price_drop means price < base price; low_stock means stock <= 5).
- signals: the reason codes that drove this decision.

Rules: use only product ids from the catalog. Never feature a product with stock 0. Respect the budget unless nothing fits. A stated need outranks inferred behaviour. Don't repeat a product across more than two sections.`;

function renderInput(i: DecisionInput): string {
  const catalog = i.products
    .map((p) => `${p.id}|${p.name}|${p.category}|${p.price}|${p.basePrice}|${p.stock}|${p.sold}|${p.tags.join(",")}`)
    .join("\n");
  return [
    `trigger: ${i.trigger}`,
    `preferences: ${JSON.stringify(i.user.prefs)}`,
    `profile: ${JSON.stringify(i.profile)}`,
    `recently_engaged: ${i.recentIds.join(",") || "none"}`,
    `cart: ${i.cartIds.join(",") || "empty"}`,
    `catalog (id|name|category|price|base_price|stock|sold|tags):\n${catalog}`,
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
