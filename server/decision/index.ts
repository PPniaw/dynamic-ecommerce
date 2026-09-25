import Anthropic from "@anthropic-ai/sdk";
import type { Product } from "../../shared/catalog.ts";
import type { Decision, DecisionEnvelope, Section } from "../../shared/decision.ts";
import { claudeEnabled, decideWithClaude } from "./claude.ts";
import { HERO_COUNT, holdsNoProducts, MAX_SECTIONS, MIN_SECTIONS, sectionCount } from "./limits.ts";
import { decideWithRules } from "./rules.ts";
import { decideWithTypeSafe, typesafeEnabled } from "./typesafe.ts";
import type { DecisionInput } from "./types.ts";

export type { DecisionInput };

// Structured outputs guarantee the *shape*; they can't guarantee the ids are
// real or in stock right now (the catalog may have moved while the model was
// thinking), nor that counts fit the renderers. Clean that up here rather
// than trusting it. The rule engine goes through the same pass.
export function sanitize(d: Decision, products: Product[]): Decision {
  const live = new Map(products.map((p) => [p.id, p]));
  const ok = (id: string) => (live.get(id)?.stock ?? 0) > 0;
  const clean = (ids: string[], n: number) => [...new Set(ids.filter(ok))].slice(0, n);

  let sections: Section[] = d.sections.map((s) => {
    // `category` only means something on a category section.
    let category: Section["category"] = s.intent === "category" || s.kind === "categories" ? s.category : "none";
    let ids = s.productIds;
    if (s.intent === "category" && !holdsNoProducts(s)) {
      // A category rail without a category: name it after what it actually holds.
      if (category === "none") category = dominantCategory(ids.filter(ok), live) ?? "none";
      if (category !== "none") ids = ids.filter((id) => live.get(id)?.category === category);
    }
    return { ...s, category, productIds: clean(ids, sectionCount(s)) };
  }).filter((s) => holdsNoProducts(s) || s.productIds.length > 0);

  // Top up to the minimum with rails nobody can argue with, then cap.
  const inStock = products.filter((p) => p.stock > 0);
  const fillers: Section[] = [
    { kind: "rail", layout: "grid", intent: "trending", category: "none", surface: "page", productIds: [...inStock].sort((a, b) => b.sold - a.sold).map((p) => p.id) },
    { kind: "rail", layout: "grid", intent: "new_arrivals", category: "none", surface: "subtle", productIds: [...inStock].sort((a, b) => Number(!!b.isNew) - Number(!!a.isNew)).map((p) => p.id) },
    { kind: "categories", layout: "grid", intent: "category", category: "none", surface: "page", productIds: [] },
  ];
  for (const f of fillers) {
    if (sections.length >= MIN_SECTIONS) break;
    if (sections.some((s) => s.kind === f.kind && s.intent === f.intent)) continue;
    sections.push({ ...f, productIds: clean(f.productIds, sectionCount(f)) });
  }
  sections = sections.slice(0, MAX_SECTIONS);

  // Hero: valid ids, exactly as many as the variant shows; fill from the first
  // rail (then anything in stock) if the model gave too few.
  const heroN = HERO_COUNT[d.hero.variant];
  const heroIds = clean(d.hero.productIds, heroN);
  const firstRail = sections.find((s) => s.productIds.length > 0)?.productIds ?? [];
  for (const id of [...firstRail, ...inStock.map((p) => p.id)]) {
    if (heroIds.length >= heroN) break;
    if (!heroIds.includes(id)) heroIds.push(id);
  }

  const seen = new Set<string>();
  return {
    ...d,
    hero: { ...d.hero, productIds: heroIds },
    sections,
    highlights: d.highlights.filter((h) => ok(h.productId) && !seen.has(h.productId) && seen.add(h.productId)),
    signals: [...new Set(d.signals)],
  };
}

function dominantCategory(ids: string[], live: Map<string, Product>): Product["category"] | undefined {
  const n = new Map<Product["category"], number>();
  for (const id of ids) { const c = live.get(id)!.category; n.set(c, (n.get(c) ?? 0) + 1); }
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

// Any LLM engine configured? (TypeSafe wins when both keys are set.)
export const llmEnabled = () => typesafeEnabled() || claudeEnabled();

export async function decide(input: DecisionInput): Promise<DecisionEnvelope> {
  const t0 = Date.now();
  if (typesafeEnabled()) {
    try {
      const d = await decideWithTypeSafe(input);
      return { decision: sanitize(d, input.products), source: "typesafe", latencyMs: Date.now() - t0, at: Date.now(), trigger: input.trigger };
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 401) console.error("[decide] TypeSafe auth failed — check TYPESAFE_API_KEY");
      else console.warn(`[decide] TypeSafe failed${e.status ? ` (${e.status})` : ""}:`, e.message);
    }
  } else if (claudeEnabled()) {
    try {
      const d = await decideWithClaude(input);
      return { decision: sanitize(d, input.products), source: "claude", latencyMs: Date.now() - t0, at: Date.now(), trigger: input.trigger };
    } catch (err) {
      // Most-specific first: a bad key won't fix itself, a 429/5xx might.
      if (err instanceof Anthropic.AuthenticationError) console.error("[decide] Claude auth failed — check ANTHROPIC_API_KEY");
      else if (err instanceof Anthropic.RateLimitError) console.warn("[decide] rate limited, using rules this round");
      else if (err instanceof Anthropic.APIError) console.warn(`[decide] API ${err.status}: ${err.message}`);
      else console.warn("[decide] Claude failed:", (err as Error).message);
    }
  }
  const d = decideWithRules(input);
  return { decision: sanitize(d, input.products), source: "rules", latencyMs: Date.now() - t0, at: Date.now(), trigger: input.trigger };
}

export { decideWithRules };
