// Deterministic fallback engine. Runs when there is no API key, when Claude
// errors or refuses, and as the instant first paint while Claude thinks.
// Same output schema as the Claude engine — the frontend can't tell them apart.
import type { Decision } from "../../shared/decision.ts";
import type { DecisionInput } from "./types.ts";

export function decideWithRules(input: DecisionInput): Decision {
  const { user, profile, products, recentIds, cartIds } = input;
  const { prefs } = user;
  const signals = new Set<Decision["signals"][number]>();
  const inStock = products.filter((p) => p.stock > 0);
  const budget = prefs.budget ?? Infinity;
  const need = prefs.need;
  const gift = /禮|送|生日|gift/i.test(need);
  if (need) signals.add("explicit_need");
  if (gift) signals.add("gift_intent");
  if (prefs.budget) signals.add("budget_cap");
  if (profile.eventCount === 0 && prefs.categories.length === 0) signals.add("cold_start");

  const score = (p: (typeof products)[number]) => {
    let s = profile.affinity[p.category] * 3;
    if (prefs.categories.includes(p.category)) s += 2;
    s += p.tags.filter((t) => profile.topTags.includes(t)).length * 0.8;
    if (gift && p.tags.includes("gift")) s += 2.5;
    if (need && p.name.split("").some((ch) => need.includes(ch) && /\p{Script=Han}/u.test(ch))) s += 0.3;
    if (p.price > budget) s -= 4;
    if (p.price < p.basePrice) s += 1;
    return s + Math.log1p(p.sold) * 0.2;
  };
  const ranked = [...inStock].sort((a, b) => score(b) - score(a));
  const ids = (xs: typeof products, n = 8) => xs.slice(0, n).map((p) => p.id);

  const deals = inStock.filter((p) => p.price < p.basePrice).sort((a, b) => a.price / a.basePrice - b.price / b.basePrice);
  const low = inStock.filter((p) => p.stock <= 5).sort((a, b) => score(b) - score(a));
  const trending = [...inStock].sort((a, b) => b.sold - a.sold);
  if (deals.length) signals.add("price_drop");
  if (low.length) signals.add("stock_urgency");
  if (cartIds.length) signals.add("cart_intent");

  const topCat = Object.entries(profile.affinity).sort((a, b) => b[1] - a[1])[0];
  if (topCat && topCat[1] > 0) signals.add("category_affinity");

  const sections: Decision["sections"] = [];
  if (gift) sections.push({ kind: "gift_ideas", category: "none", layout: "carousel", productIds: ids(ranked.filter((p) => p.tags.includes("gift"))) });
  sections.push({ kind: "for_you", category: "none", layout: "grid", productIds: ids(ranked) });
  if (deals.length) sections.push({ kind: "deals", category: "none", layout: "carousel", productIds: ids(deals) });
  if (recentIds.length) {
    const cats = new Set(recentIds.map((id) => products.find((p) => p.id === id)?.category));
    sections.push({ kind: "because_viewed", category: "none", layout: "compact_grid", productIds: ids(ranked.filter((p) => cats.has(p.category) && !recentIds.includes(p.id))) });
  }
  if (low.length) sections.push({ kind: "low_stock", category: "none", layout: "list", productIds: ids(low, 5) });
  if (prefs.budget) sections.push({ kind: "budget_picks", category: "none", layout: "compact_grid", productIds: ids(ranked.filter((p) => p.price <= budget)) });
  if (topCat && topCat[1] > 0) {
    const c = topCat[0] as Decision["sections"][number]["category"];
    sections.push({ kind: "category", category: c, layout: "grid", productIds: ids(ranked.filter((p) => p.category === c)) });
  }
  sections.push({ kind: "trending", category: "none", layout: "carousel", productIds: ids(trending) });

  // Theme: explicit style wins; otherwise infer from the tags they gravitate to.
  const tags = profile.topTags;
  const style = prefs.style !== "auto" ? prefs.style
    : tags.includes("dark") ? "dark" : tags.includes("minimal") ? "minimal" : tags.includes("vivid") || tags.includes("cute") ? "vivid" : "auto";
  if (style === "dark") signals.add("dark_preference");
  if (style === "minimal") signals.add("minimal_style");
  if (style === "vivid") signals.add("vivid_style");
  if (tags.includes("premium")) signals.add("premium_taste");
  if (tags.includes("budget") || prefs.budget) signals.add("price_sensitive");

  const theme: Decision["theme"] =
    style === "dark" ? { primaryColor: "violet", colorScheme: "dark", radius: "sm", density: "comfortable", font: "sans" }
    : style === "minimal" ? { primaryColor: "dark", colorScheme: "light", radius: "xs", density: "spacious", font: "serif" }
    : style === "vivid" ? { primaryColor: gift ? "pink" : "orange", colorScheme: "light", radius: "xl", density: "compact", font: "rounded" }
    : { primaryColor: gift ? "pink" : "blue", colorScheme: "light", radius: "md", density: "comfortable", font: "sans" };

  const heroP = low.find((p) => ranked.slice(0, 6).includes(p)) ?? deals.find((p) => ranked.slice(0, 6).includes(p)) ?? ranked[0] ?? products[0];
  const variant: Decision["hero"]["variant"] =
    heroP.stock <= 5 ? "last_chance" : heroP.price < heroP.basePrice ? "deal" : gift ? "gift" : "spotlight";

  const badges: Decision["badges"] = [];
  for (const p of inStock) {
    if (p.price < p.basePrice * 0.9) badges.push({ productId: p.id, badge: "price_drop" });
    else if (p.stock <= 5) badges.push({ productId: p.id, badge: "low_stock" });
    else if (trending.indexOf(p) < 3 && p.sold > 0) badges.push({ productId: p.id, badge: "hot" });
  }
  for (const id of ids(ranked, 3)) badges.push({ productId: id, badge: "for_you" });

  return {
    theme,
    hero: { productId: heroP.id, variant },
    sections: sections.filter((s) => s.productIds.length > 0).slice(0, 6),
    badges,
    signals: [...signals],
  };
}
