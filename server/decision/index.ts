import Anthropic from "@anthropic-ai/sdk";
import type { Decision, DecisionEnvelope, Product } from "../../shared/decision.ts";
import { claudeEnabled, decideWithClaude } from "./claude.ts";
import { decideWithRules } from "./rules.ts";
import type { DecisionInput } from "./types.ts";

export type { DecisionInput };

// Structured outputs guarantee the *shape*; they can't guarantee the ids are
// real or in stock right now (the catalog may have moved while the model was
// thinking). Clean that up here rather than trusting it.
export function sanitize(d: Decision, products: Product[]): Decision {
  const live = new Map(products.map((p) => [p.id, p]));
  const ok = (id: string) => (live.get(id)?.stock ?? 0) > 0;
  const sections = d.sections
    .map((s) => ({ ...s, productIds: [...new Set(s.productIds.filter(ok))].slice(0, 8) }))
    .filter((s) => s.productIds.length > 0)
    .slice(0, 6);
  const firstId = sections[0]?.productIds[0] ?? products.find((p) => p.stock > 0)?.id ?? products[0].id;
  const seen = new Set<string>();
  return {
    ...d,
    hero: ok(d.hero.productId) ? d.hero : { productId: firstId, variant: "spotlight" },
    sections,
    badges: d.badges.filter((b) => live.has(b.productId) && !seen.has(b.productId) && seen.add(b.productId)),
    signals: [...new Set(d.signals)],
  };
}

export async function decide(input: DecisionInput): Promise<DecisionEnvelope> {
  const t0 = Date.now();
  if (claudeEnabled()) {
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
