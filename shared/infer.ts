// Behaviour → personality traits. The shopper never has to fill the persona
// panel: how they browse is summarised here, a reader (Jev on the server, the
// rules below as fallback and in the static preview) says how likely each
// trait is, and confident ones are added to the persona as *inferred*.
//
// Inferred traits are marked (persona.inferred) so the panel can show them as
// guesses. A guess the shopper removes goes to persona.rejected and is never
// guessed again; a trait the shopper states (panel or chat) stops being a guess.
import type { Product } from "./catalog.ts";
import type { CartLine, UserPrefs } from "./decision.ts";
import type { Trait } from "./personas.ts";
import type { ProfileEvent } from "./profile.ts";

// What browsing can plausibly show. 內向 / 外向 / 感性 / 理性 can't be read off clicks.
export const INFERABLE = ["慢活", "衝動", "好奇", "務實", "比價", "念舊", "愛冒險", "夜貓子", "重設計", "愛送禮"] as const satisfies readonly Trait[];
export type InferableTrait = (typeof INFERABLE)[number];

export const ADD_AT = 0.75;  // add a guess at or above this
export const DROP_AT = 0.35; // drop an earlier guess below this (hysteresis)
export const MIN_EVENTS = 4; // too little behaviour → no guesses

export interface BehaviourSummary {
  local_hour: number;
  events: number;
  counts: Record<string, number>;
  recent: { action: string; name: string; category: string; price: number; on_sale: boolean; tags: string[]; seconds_ago: number }[];
  categories_browsed: number;
  avg_viewed_price: number | null;
  catalog_median_price: number;
  on_sale_share_of_views: number;
  tag_shares: Record<string, number>;
  quick_adds: number;       // added to cart within 20s of first looking at it
  events_per_minute: number; // over the last 5 minutes
  cart_value: number;
}

// `events` newest first. `hour` is the shopper's local hour.
export function behaviourSummary(events: ProfileEvent[], cart: CartLine[], products: Product[], hour: number, now = Date.now()): BehaviourSummary {
  const byId = new Map(products.map((p) => [p.id, p]));
  const recentEv = events.slice(0, 40);
  const counts: Record<string, number> = {};
  for (const e of recentEv) counts[e.type] = (counts[e.type] ?? 0) + 1;

  const engaged = recentEv.filter((e) => e.productId && byId.has(e.productId));
  const views = engaged.filter((e) => e.type === "view").map((e) => byId.get(e.productId!)!);
  const tags = new Map<string, number>();
  for (const e of engaged) for (const t of byId.get(e.productId!)!.tags) tags.set(t, (tags.get(t) ?? 0) + 1);

  // First look at each product vs when it went into the cart.
  const firstSeen = new Map<string, number>();
  for (const e of [...recentEv].reverse()) if (e.productId && !firstSeen.has(e.productId)) firstSeen.set(e.productId, e.ts);
  const quickAdds = recentEv.filter((e) => e.type === "add_to_cart" && e.productId && e.ts - (firstSeen.get(e.productId) ?? e.ts) < 20_000).length;

  const prices = products.map((p) => p.price).sort((a, b) => a - b);
  return {
    local_hour: hour,
    events: events.length,
    counts,
    recent: engaged.slice(0, 12).map((e) => {
      const p = byId.get(e.productId!)!;
      return { action: e.type, name: p.name, category: p.category, price: p.price, on_sale: p.compareAt !== undefined, tags: p.tags, seconds_ago: Math.round((now - e.ts) / 1000) };
    }),
    categories_browsed: new Set(engaged.slice(0, 20).map((e) => byId.get(e.productId!)!.category)).size,
    avg_viewed_price: views.length ? Math.round(views.reduce((s, p) => s + p.price, 0) / views.length) : null,
    catalog_median_price: prices[Math.floor(prices.length / 2)] ?? 0,
    on_sale_share_of_views: views.length ? +(views.filter((p) => p.compareAt !== undefined).length / views.length).toFixed(2) : 0,
    tag_shares: Object.fromEntries([...tags].map(([t, n]) => [t, +(n / Math.max(1, engaged.length)).toFixed(2)])),
    quick_adds: quickAdds,
    events_per_minute: +(events.filter((e) => now - e.ts < 5 * 60_000).length / 5).toFixed(1),
    cart_value: cart.reduce((s, l) => s + (byId.get(l.productId)?.price ?? 0) * l.qty, 0),
  };
}

// The same summary as plain observations. Jev reads these far better than the
// raw numbers (on-sale share 0.75 + two quick adds → 比價 0.60 raw).
export function observations(b: BehaviourSummary): string[] {
  const o: string[] = [];
  const views = b.counts.view ?? 0;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  o.push(`It is ${b.local_hour}:00 local time.`);
  o.push(`${b.events} actions so far: ${Object.entries(b.counts).map(([k, n]) => `${n} ${k.replace(/_/g, " ")}`).join(", ")}.`);
  if (views) o.push(`${Math.round(b.on_sale_share_of_views * views)} of the ${views} products viewed were on sale.`);
  if (b.quick_adds) o.push(`Added ${b.quick_adds} product(s) to the cart within 20 seconds of first seeing them.`);
  o.push(`Browsed ${b.categories_browsed} different categories out of 6.`);
  if (b.avg_viewed_price !== null) {
    const r = b.avg_viewed_price / b.catalog_median_price;
    o.push(`Viewed products average NT$${b.avg_viewed_price}, ${r >= 1.25 ? "well above" : r <= 0.8 ? "well below" : "close to"} the shop's median of NT$${b.catalog_median_price}.`);
  }
  const tagWords: Record<string, string> = { handmade: "handmade", gift: "giftable", premium: "premium", minimal: "minimalist design", daily: "everyday practical", calm: "calming / relaxing", local: "local makers" };
  const tags = Object.entries(b.tag_shares).filter(([, v]) => v >= 0.3).sort((a, b) => b[1] - a[1]);
  if (tags.length) o.push(`Of the products engaged with: ${tags.map(([t, v]) => `${pct(v)} ${tagWords[t] ?? t}`).join(", ")}.`);
  o.push(`Pace: ${b.events_per_minute} actions per minute.`);
  if (b.cart_value) o.push(`Cart value NT$${b.cart_value}.`);
  o.push(`Recently: ${b.recent.slice(0, 8).map((r) => `${r.action.replace(/_/g, " ")} ${r.name} (${r.category}, NT$${r.price}${r.on_sale ? ", on sale" : ""})`).join("; ")}.`);
  return o;
}

// Transparent fallback: a few readable rules. Jev replaces this on the server.
export function inferTraitsByRules(b: BehaviourSummary): Partial<Record<Trait, number>> {
  if (b.events < MIN_EVENTS) return {};
  const share = (t: string) => b.tag_shares[t] ?? 0;
  const views = b.counts.view ?? 0;
  const carryShare = b.recent.length ? b.recent.filter((r) => r.category === "carry").length / b.recent.length : 0;
  const yes = (cond: boolean, p = 0.8) => (cond ? p : 0.2);
  return {
    比價: yes(views >= 3 && b.on_sale_share_of_views >= 0.5, 0.85),
    重設計: yes(share("premium") + share("minimal") >= 0.5 || (b.avg_viewed_price ?? 0) >= b.catalog_median_price * 1.3),
    念舊: yes(share("handmade") >= 0.4),
    愛送禮: yes(share("gift") >= 0.5),
    好奇: yes(b.categories_browsed >= 4),
    衝動: yes(b.quick_adds >= 2, 0.85),
    夜貓子: yes(b.local_hour >= 23 || b.local_hour < 4, 0.9),
    務實: yes(share("daily") >= 0.5, 0.75),
    慢活: yes(share("calm") >= 0.4, 0.75),
    愛冒險: yes(carryShare >= 0.5, 0.75),
  };
}

// Jev alone leans on a few traits for everyone (重設計 ~0.7–0.78 for both a
// bargain hunter and a slow gift browser); the rules only fire on concrete
// evidence. Blending keeps Jev's judgement and cancels that bias.
export const JEV_WEIGHT = 0.6;
export function blend(jev: Partial<Record<Trait, number>>, rules: Partial<Record<Trait, number>>): Partial<Record<Trait, number>> {
  const out: Partial<Record<Trait, number>> = {};
  for (const t of INFERABLE) {
    const a = jev[t], b = rules[t];
    if (a !== undefined && b !== undefined) out[t] = +(a * JEV_WEIGHT + b * (1 - JEV_WEIGHT)).toFixed(2);
    else if (a !== undefined || b !== undefined) out[t] = (a ?? b)!;
  }
  return out;
}

const OPPOSITE: Partial<Record<Trait, Trait>> = { 慢活: "衝動", 衝動: "慢活" };

export interface InferChange { added: Trait[]; dropped: Trait[] }

// Merge a reader's probabilities into the persona.
export function applyInferred(prefs: UserPrefs, probs: Partial<Record<Trait, number>>): { prefs: UserPrefs; change: InferChange } {
  const p = prefs.persona;
  const inferred = new Set(p.inferred ?? []);
  const rejected = new Set(p.rejected ?? []);
  const declared = new Set(p.traits.filter((t) => !inferred.has(t)));
  const traits = new Set(p.traits);
  const change: InferChange = { added: [], dropped: [] };

  for (const t of INFERABLE) {
    const v = probs[t];
    if (v === undefined) continue;
    if (inferred.has(t) && v < DROP_AT) {
      inferred.delete(t); traits.delete(t); change.dropped.push(t);
    } else if (!traits.has(t) && v >= ADD_AT && !rejected.has(t)) {
      const opp = OPPOSITE[t];
      if (opp && declared.has(opp)) continue; // never contradict what they said
      if (opp && inferred.has(opp)) { inferred.delete(opp); traits.delete(opp); change.dropped.push(opp); }
      inferred.add(t); traits.add(t); change.added.push(t);
    }
  }
  if (!change.added.length && !change.dropped.length) return { prefs, change };
  return { prefs: { ...prefs, persona: { ...p, traits: [...traits], inferred: [...inferred], rejected: [...rejected] } }, change };
}

// The shopper edited their persona by hand: a guess they removed is rejected
// for good; a trait they (re)added themselves is theirs, not a guess.
export function mergeManualPrefs(old: UserPrefs, next: UserPrefs): UserPrefs {
  const oldInferred = old.persona.inferred ?? [];
  const removed = oldInferred.filter((t) => !next.persona.traits.includes(t));
  const rejected = new Set([...(old.persona.rejected ?? []), ...removed]);
  for (const t of next.persona.traits) if (!oldInferred.includes(t)) rejected.delete(t);
  const inferred = oldInferred.filter((t) => next.persona.traits.includes(t));
  return { ...next, persona: { ...next.persona, inferred, rejected: [...rejected] } };
}

// Traits stated in chat stop being guesses.
export function declareTraits(prefs: UserPrefs, traits: Trait[]): UserPrefs {
  if (!traits.length || !prefs.persona.inferred?.length && !prefs.persona.rejected?.length) return prefs;
  const p = prefs.persona;
  return { ...prefs, persona: { ...p, inferred: (p.inferred ?? []).filter((t) => !traits.includes(t)), rejected: (p.rejected ?? []).filter((t) => !traits.includes(t)) } };
}

// When to run: enough behaviour, and not more than once per cooldown / few events.
export const INFER_COOLDOWN_MS = 15_000;
export const INFER_EVERY_EVENTS = 3;
export const BEHAVIOUR_TRIGGERS = new Set(["view", "favorite", "search", "add_to_cart", "remove_from_cart", "purchase"]);

export function localHour(tz = "Asia/Taipei", now = new Date()): number {
  try { return Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(now)); }
  catch { return now.getHours(); }
}
