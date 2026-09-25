// jev (TypeSafe AI) as the storefront's decision maker.
//
// jev doesn't write JSON: it answers named questions — choice, yes/no ("noul")
// or score — each with probabilities. So it makes the *judgements* (which
// store, light or dark, which headline, is this a gift, which products this
// shopper wants) and the rule engine builds the Decision from them. Same
// output shape as the other engines, same sanitize pass after.
//
// Talks to the HTTP API directly (POST /v1/systemone, as the official
// @typesafe-ai/sdk does) instead of pulling in the SDK.
import { ARCHETYPES, HEADLINES, type Archetype, type Decision } from "../../shared/decision.ts";
import type { Product } from "../../shared/catalog.ts";
import { decideWithRules, type DecisionHints } from "./rules.ts";
import type { DecisionInput } from "./types.ts";

// Same env names as the official SDK, so its docs apply as-is.
const BASE_URL = (process.env.TYPESAFE_BASE_URL?.trim() || "https://api.typesafe.ai").replace(/\/+$/, "");
const MODEL = process.env.TYPESAFE_DEFAULT_MODEL?.trim() || "jev-latest";
// Runs after every shopper action; a slow answer is worse than the rule engine's.
const TIMEOUT_MS = Number(process.env.SHOP_JEV_TIMEOUT_MS ?? 8000);

export const jevEnabled = () => Boolean(process.env.TYPESAFE_API_KEY?.trim());

export class JevError extends Error {
  constructor(message: string, readonly status?: number) { super(message); }
}

// ---- questions ----------------------------------------------------------------

type Question =
  | { type: "choice"; instructions: string; criteria: Record<string, string | null> }
  | { type: "noul"; instructions: string; criteria?: { true?: string; false?: string } };

interface ChoiceAnswer { type: "choice"; choice: string; confidence: number; probabilities: Record<string, number> }
interface NoulAnswer { type: "noul"; noul: number }
interface SystemOneResult { model: string; answers: Record<string, ChoiceAnswer | NoulAnswer>; usage: { input_tokens: number; output_tokens: number } }

// Descriptions are what jev scores against — they carry the same persona
// cues the Claude prompt uses for each store.
const ARCHETYPE_CRITERIA: Record<Archetype, string> = {
  editorial: "Magazine-like store with big photos, maker stories and lots of white space. For slow, sentimental, story-driven shoppers who buy things to keep: introverted feelers (INFx / ISFx), water signs, traits like 慢活 / 念舊 / 感性, interests like 閱讀 / 陶藝 / 茶 / 手沖咖啡 / 香氛.",
  collage: "Playful sticker-and-collage store full of surprises. For curious, impulsive, experience-seeking shoppers: extroverted intuitives (ENxP), fire signs, traits like 好奇 / 衝動 / 愛冒險 / 外向, interests like 露營 / 音樂祭 / 攝影 / 植物.",
  index: "Dense spec-table store with no decoration, for comparing. For analytical shoppers who compare before buying and dislike ad-like pages: xNTJ / xSTJ thinkers, air signs, traits like 理性 / 重設計, interests like 鋼筆 / 手帳 / 設計.",
  deal: "Price-first store with countdowns, big prices and add-to-cart everywhere. For practical, time-pressed, price-driven shoppers: xSTJ / ESxx, earth signs, traits like 務實 / 比價 / 愛送禮, a budget cap, many clicks on discounted items, an urgent or gift need.",
};

const HEADLINE_CRITERIA: Record<Decision["hero"]["headline"], string> = {
  slow_living: "Everyday things worth keeping; calm, unhurried.",
  made_by_hand: "Handmade pieces with a maker's touch.",
  new_this_week: "What just arrived this week.",
  for_you: "The store rearranged around what this shopper looked at.",
  gift_season: "Gifts that the recipient will use every day.",
  deals_now: "Prices are dropping right now; a flash sale.",
  last_chance: "Items almost sold out.",
  the_index: "A plain index of every item: origin, price, stock, no adjectives.",
  weekend_adventure: "Small things for camping, markets and festivals.",
};

// Answer names are free-form keys; keep product ids out of the fixed names.
const productKey = (id: string) => `want_${id}`;

function buildQuestions(candidates: Product[]): Record<string, Question> {
  const q: Record<string, Question> = {
    archetype: {
      type: "choice",
      instructions: "Which kind of store fits this shopper best? Stated need and recent behaviour outrank astrology; zodiac is only a light tie-breaker.",
      criteria: Object.fromEntries(ARCHETYPES.map((a) => [a, ARCHETYPE_CRITERIA[a]])),
    },
    scheme: {
      type: "choice",
      instructions: "Should this shopper's store be light or dark?",
      criteria: { light: "A bright, daytime page.", dark: "A dark page: night owls, late-night browsing, a sleek utility look." },
    },
    headline: {
      type: "choice",
      instructions: "Which opening message would make this shopper keep browsing?",
      criteria: { ...HEADLINE_CRITERIA },
    },
    gift: {
      type: "noul",
      instructions: "Is this shopper shopping for a gift for someone else?",
    },
  };
  for (const p of candidates) {
    q[productKey(p.id)] = {
      type: "noul",
      instructions: `Would this shopper want 「${p.name}」 (${p.maker}; category ${p.category}; NT$${p.price}; tags ${p.tags.join(", ") || "none"})?`,
    };
  }
  return q;
}

// Shopper and market as structured state. Only what the questions need:
// the catalog details ride along in each product question.
function buildState(i: DecisionInput) {
  const { persona, ...prefs } = i.user.prefs;
  return {
    trigger: i.trigger,
    persona,
    preferences: prefs,
    profile: i.profile,
    recently_engaged: i.recentIds.map((id) => i.products.find((p) => p.id === id)?.name ?? id),
    cart: i.cartIds.map((id) => i.products.find((p) => p.id === id)?.name ?? id),
  };
}

async function systemOne(state: unknown, questions: Record<string, Question>): Promise<SystemOneResult> {
  const res = await fetch(`${BASE_URL}/v1/systemone`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TYPESAFE_API_KEY!.trim()}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, state, questions }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new JevError(`HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`, res.status);
  }
  return (await res.json()) as SystemOneResult;
}

// ---- decision -------------------------------------------------------------------

const isChoice = (a: unknown): a is ChoiceAnswer => (a as ChoiceAnswer)?.type === "choice" && typeof (a as ChoiceAnswer).choice === "string";
const isNoul = (a: unknown): a is NoulAnswer => (a as NoulAnswer)?.type === "noul" && typeof (a as NoulAnswer).noul === "number";

// Turn answers into hints, dropping anything off-menu. A missing or malformed
// answer just leaves that judgement to the rule engine.
export function hintsFromAnswers(answers: SystemOneResult["answers"], candidates: Product[]): DecisionHints {
  const pick = <T extends string>(key: string, allowed: readonly T[]): T | undefined => {
    const a = answers[key];
    return isChoice(a) && (allowed as readonly string[]).includes(a.choice) ? (a.choice as T) : undefined;
  };
  const relevance = new Map<string, number>();
  for (const p of candidates) {
    const a = answers[productKey(p.id)];
    if (isNoul(a)) relevance.set(p.id, Math.min(1, Math.max(0, a.noul)));
  }
  const gift = answers.gift;
  return {
    archetype: pick("archetype", ARCHETYPES),
    scheme: pick("scheme", ["light", "dark"] as const),
    headline: pick("headline", HEADLINES),
    gift: isNoul(gift) ? gift.noul >= 0.5 : undefined,
    relevance: relevance.size ? relevance : undefined,
  };
}

export async function decideWithJev(input: DecisionInput): Promise<Decision> {
  // Sold-out products can't be featured anyway; don't pay to ask about them.
  const candidates = input.products.filter((p) => p.stock > 0);
  const res = await systemOne(buildState(input), buildQuestions(candidates));
  if (!res?.answers || typeof res.answers !== "object") throw new JevError("response has no answers");
  return decideWithRules(input, hintsFromAnswers(res.answers, candidates));
}
