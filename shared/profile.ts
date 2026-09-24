// Event log → preference profile. Pure: the server feeds it rows from SQLite,
// the static preview feeds it an in-memory log. Both decision engines read
// the result, so the LLM gets a compact summary instead of raw rows.
import { SHOP_CATEGORIES, type Product, type ShopCategory } from "./catalog.ts";
import type { CartLine, EventType, Profile } from "./decision.ts";

export interface ProfileEvent { type: EventType; productId: string | null; ts: number }

// How much each action says about intent. A purchase is a much stronger signal
// than a glance.
const WEIGHT = { view: 1, search: 0.5, favorite: 3, add_to_cart: 5, remove_from_cart: -2, purchase: 8 } as const;
// Interest fades: half-life of 10 minutes keeps the demo visibly reactive.
const HALF_LIFE_MS = 10 * 60_000;
const DEAL_WINDOW_MS = 30 * 60_000;

// `events` newest first.
export function profileFrom(events: ProfileEvent[], cart: CartLine[], products: Product[], now = Date.now()): Profile {
  const byId = new Map(products.map((p) => [p.id, p]));
  const affinity = Object.fromEntries(SHOP_CATEGORIES.map((c) => [c, 0])) as Record<ShopCategory, number>;
  const tagScore = new Map<string, number>();
  let priceSum = 0;
  let priceN = 0;
  // Deal-seeking: views / cart adds on products that are on sale *right now*
  // (compareAt only exists while price < list). Recent = inside DEAL_WINDOW_MS,
  // unweighted, so the number reads as a plain count in the decision panel.
  let dealClicks = 0;

  for (const e of events) {
    const p = e.productId ? byId.get(e.productId) : undefined;
    if (!p) continue;
    const w = WEIGHT[e.type] * Math.pow(0.5, (now - e.ts) / HALF_LIFE_MS);
    affinity[p.category] += w;
    for (const t of p.tags) tagScore.set(t, (tagScore.get(t) ?? 0) + w);
    if (e.type === "view") { priceSum += p.price; priceN++; }
    if ((e.type === "view" || e.type === "add_to_cart") && p.compareAt !== undefined && now - e.ts < DEAL_WINDOW_MS) dealClicks++;
  }

  // Normalise to 0..1 so the numbers mean the same thing for every user.
  const max = Math.max(...Object.values(affinity), 1e-9);
  for (const c of SHOP_CATEGORIES) affinity[c] = Math.max(0, +(affinity[c] / max).toFixed(2));

  return {
    affinity,
    avgViewedPrice: priceN ? Math.round(priceSum / priceN) : null,
    topTags: [...tagScore.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t]) => t),
    eventCount: events.length,
    cartValue: cart.reduce((s, l) => s + (byId.get(l.productId)?.price ?? 0) * l.qty, 0),
    dealClicks,
  };
}

// Most recent distinct products the shopper engaged with. `events` newest first.
export function recentIdsFrom(events: ProfileEvent[], n = 8): string[] {
  const seen = new Set<string>();
  for (const e of events.slice(0, 50)) {
    if (e.productId && (e.type === "view" || e.type === "favorite" || e.type === "add_to_cart")) seen.add(e.productId);
    if (seen.size >= n) break;
  }
  return [...seen];
}
