// Deterministic fallback engine. Runs when there is no API key, when Claude
// errors or refuses, and as the instant first paint while Claude thinks.
// Same output schema as the Claude engine — the frontend can't tell them apart.
//
// Shape of the decision: pick an archetype (explicit override, else the
// transparent persona score in shared/archetypes.ts), take its designed preset
// as-is, apply a few persona tweaks, then fill the preset's section rhythm with
// products chosen by each section's intent.
import { ARCHETYPE_PRESETS, pickArchetype, scoreArchetypes } from "../../shared/archetypes.ts";
import type { Product, ShopCategory } from "../../shared/catalog.ts";
import type { Decision, Section } from "../../shared/decision.ts";
import type { Interest, Persona, Trait } from "../../shared/personas.ts";
import { HERO_COUNT, MAX_SECTIONS, sectionCount } from "./limits.ts";
import type { DecisionInput } from "./types.ts";

type Signal = Decision["signals"][number];

// What an interest / trait says about the catalog: categories it points at and
// product tags it likes. Deliberately small and legible — this is the part of
// the persona the rule engine can act on; everything subtler is Claude's job.
const INTEREST_HINTS: Record<Interest, { cats?: ShopCategory[]; tags?: string[] }> = {
  閱讀: { cats: ["paper"], tags: ["calm"] },
  手沖咖啡: { cats: ["brew"] },
  茶: { cats: ["brew"] },
  陶藝: { cats: ["table"], tags: ["handmade"] },
  香氛: { cats: ["scent"], tags: ["calm"] },
  植物: { cats: ["home"] },
  露營: { cats: ["carry"] },
  攝影: { cats: ["carry"] },
  音樂祭: { cats: ["carry"] },
  鋼筆: { cats: ["paper"] },
  手帳: { cats: ["paper"] },
  設計: { tags: ["minimal", "premium"] },
  烹飪: { cats: ["table"] },
  通勤: { cats: ["carry"], tags: ["daily"] },
  送禮: { tags: ["gift"] },
};
const TRAIT_TAGS: Partial<Record<Trait, string[]>> = {
  慢活: ["calm"], 念舊: ["handmade"], 重設計: ["minimal", "premium"], 務實: ["daily"], 愛送禮: ["gift"],
};

const personaEmpty = (p: Persona) => !p.mbti && !p.zodiac && p.traits.length === 0 && p.interests.length === 0;

export function decideWithRules(input: DecisionInput): Decision {
  const { user, profile, products, recentIds, cartIds } = input;
  const { prefs } = user;
  const persona = prefs.persona;
  const signals = new Set<Signal>();
  const inStock = products.filter((p) => p.stock > 0); // never feature stock 0
  const byId = new Map(products.map((p) => [p.id, p]));
  const budget = prefs.budget ?? Infinity;
  const gift = /禮|送/.test(prefs.need);
  const traits = new Set<string>(persona.traits);
  const priceSensitive = traits.has("比價") || prefs.budget != null || profile.dealClicks >= 2;

  // ---- archetype + preset --------------------------------------------------
  const archetype = prefs.archetype !== "auto"
    ? prefs.archetype
    : pickArchetype(scoreArchetypes(persona, profile.dealClicks, prefs.budget != null));
  const preset = ARCHETYPE_PRESETS[archetype];
  const theme: Decision["theme"] = {
    ...preset.theme,
    scheme: prefs.scheme !== "auto" ? prefs.scheme : traits.has("夜貓子") ? "dark" : preset.theme.scheme,
  };

  // ---- scoring ---------------------------------------------------------------
  const interestCats = new Set<ShopCategory>();
  const likedTags = new Set<string>(profile.topTags);
  for (const i of persona.interests) {
    INTEREST_HINTS[i].cats?.forEach((c) => interestCats.add(c));
    INTEREST_HINTS[i].tags?.forEach((t) => likedTags.add(t));
  }
  for (const t of persona.traits) TRAIT_TAGS[t]?.forEach((x) => likedTags.add(x));
  if (gift) likedTags.add("gift");

  const score = (p: Product) => {
    let s = profile.affinity[p.category] * 3;
    if (prefs.categories.includes(p.category)) s += 2;
    if (interestCats.has(p.category)) s += 1.2;
    s += p.tags.filter((t) => likedTags.has(t)).length * 0.8;
    if (gift && p.tags.includes("gift")) s += 1.5;
    if (p.price > budget) s -= 4;
    if (priceSensitive && p.compareAt !== undefined) s += 1;
    return s + Math.log1p(p.sold) * 0.2;
  };
  const scores = new Map(inStock.map((p) => [p.id, score(p)]));
  const byScore = (a: Product, b: Product) => scores.get(b.id)! - scores.get(a.id)!;
  const ranked = [...inStock].sort(byScore);

  // Category affinity for category rails/tiles: behaviour, stated categories, interests.
  const catScore = (c: ShopCategory) =>
    profile.affinity[c] * 3 + (prefs.categories.includes(c) ? 2 : 0) + (interestCats.has(c) ? 1.2 : 0);
  const topCats = (Object.keys(profile.affinity) as ShopCategory[])
    .map((c) => [c, catScore(c)] as const).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([c]) => c);

  const recentCats = new Set(recentIds.map((id) => byId.get(id)?.category).filter(Boolean));
  const trending = [...inStock].sort((a, b) => b.sold - a.sold || byScore(a, b));
  const discount = (p: Product) => p.price / (p.compareAt ?? p.price);
  const deals = inStock.filter((p) => p.compareAt !== undefined).sort((a, b) => discount(a) - discount(b));
  const lowStock = inStock.filter((p) => p.stock <= 5).sort(byScore);

  // Without a budget, "budget picks" means the cheaper half of what's in stock.
  const prices = inStock.map((p) => p.price).sort((a, b) => a - b);
  const cheapCap = prefs.budget ?? prices[Math.floor(prices.length / 2)] ?? Infinity;

  // A budget is a hard preference: within-budget items always come first, in
  // every pool, and anything over budget only fills leftover slots.
  const fit = (xs: Product[]) => [...xs.filter((p) => p.price <= budget), ...xs.filter((p) => p.price > budget)];
  const pool = (s: Pick<Section, "intent" | "category">): Product[] => fit(intentPool(s));
  const intentPool = (s: Pick<Section, "intent" | "category">): Product[] => {
    switch (s.intent) {
      case "for_you": return ranked;
      case "deals": return deals;
      case "low_stock": return lowStock;
      case "new_arrivals": return [...ranked.filter((p) => p.isNew), ...ranked.filter((p) => !p.isNew)];
      case "gift_ideas": return ranked.filter((p) => p.tags.includes("gift"));
      case "budget_picks": return ranked.filter((p) => p.price <= cheapCap);
      case "because_viewed": return ranked.filter((p) => recentCats.has(p.category) && !recentIds.includes(p.id));
      case "maker_story": return ranked.filter((p) => p.tags.includes("handmade") || p.tags.includes("local"));
      case "trending": return trending;
      case "category": return s.category === "none" ? ranked : ranked.filter((p) => p.category === s.category);
    }
  };

  // ---- sections --------------------------------------------------------------
  const rhythm: Omit<Section, "productIds" | "category">[] = [...preset.rhythm];
  // A gift need gets its own rail right after the opening section.
  if (gift) rhythm.splice(1, 0, { kind: "rail", layout: preset.listing.layout, intent: "gift_ideas", surface: "page" });
  // Something recently looked at → a "because you viewed" rail a little further down.
  if (recentIds.length) rhythm.splice(Math.min(rhythm.length, 3), 0, { kind: "rail", layout: preset.listing.layout, intent: "because_viewed", surface: "subtle" });

  // Category rails take the top-affinity categories in order; the tile grid
  // just highlights the top one (or none for a cold start).
  let catIdx = 0;
  const fallbackCat = trending[0]?.category;
  const sections: Section[] = rhythm.map((r) => {
    let category: Section["category"] = "none";
    if (r.intent === "category") {
      if (r.kind === "categories") category = topCats[0] ?? "none";
      else category = topCats[catIdx++] ?? fallbackCat ?? "none";
    }
    const n = sectionCount(r);
    return { ...r, category, productIds: n ? pool({ intent: r.intent, category }).slice(0, n).map((p) => p.id) : [] };
  }).filter((s) => sectionCount(s) === 0 || s.productIds.length > 0).slice(0, MAX_SECTIONS);

  // ---- hero ------------------------------------------------------------------
  const heroN = HERO_COUNT[preset.hero.variant];
  const heroPool = fit(preset.hero.variant === "flash" ? [...deals, ...ranked.filter((p) => p.compareAt === undefined)] : ranked);
  const hero: Decision["hero"] = {
    ...preset.hero,
    headline: gift ? "gift_season" : preset.hero.headline,
    productIds: heroPool.slice(0, heroN).map((p) => p.id),
  };

  // ---- highlights (recommendation badges only) -------------------------------
  const highlights: Decision["highlights"] = [];
  const badged = new Set<string>();
  const badge = (p: Product, b: Decision["highlights"][number]["badge"]) => {
    if (badged.has(p.id)) return;
    badged.add(p.id);
    highlights.push({ productId: p.id, badge: b });
  };
  ranked.slice(0, 3).forEach((p) => badge(p, "for_you"));
  // Nothing sold yet = nothing is trending; don't invent it.
  trending.filter((p) => p.sold > 0).slice(0, 2).forEach((p) => badge(p, "trending"));
  inStock.filter((p) => p.isNew).forEach((p) => badge(p, "new"));

  // ---- signals ---------------------------------------------------------------
  const m = persona.mbti ?? "";
  if (personaEmpty(persona) && profile.eventCount === 0) signals.add("cold_start");
  if (m[0] === "I" || traits.has("內向")) signals.add("persona_introvert");
  if (m[0] === "E" || traits.has("外向")) signals.add("persona_extrovert");
  if (m[2] === "F" || traits.has("感性")) signals.add("persona_feeling");
  if (m[2] === "T" || traits.has("理性")) signals.add("persona_thinking");
  if (m[1] === "S" || traits.has("務實")) signals.add("persona_practical");
  if ((m[1] === "N" && m[3] === "P") || traits.has("好奇") || traits.has("愛冒險")) signals.add("persona_curious");
  if (persona.zodiac) signals.add("zodiac_element");
  if (traits.has("夜貓子")) signals.add("night_owl");
  const interestTags = new Set(persona.interests.flatMap((i) => INTEREST_HINTS[i].tags ?? []));
  if (ranked.slice(0, 8).some((p) => interestCats.has(p.category) || p.tags.some((t) => interestTags.has(t)))) {
    signals.add("interest_match");
  }
  if (Object.values(profile.affinity).some((v) => v > 0) || prefs.categories.length) signals.add("category_affinity");
  if (priceSensitive) signals.add("price_sensitive");
  if (profile.topTags.includes("premium") || traits.has("重設計")) signals.add("premium_taste");
  if (cartIds.length) signals.add("cart_intent");
  const shown = new Set([...hero.productIds, ...sections.flatMap((s) => s.productIds)]);
  if (lowStock.some((p) => shown.has(p.id))) signals.add("stock_urgency");
  if (deals.some((p) => shown.has(p.id))) signals.add("price_drop");
  if (prefs.need.trim()) signals.add("explicit_need");
  if (gift) signals.add("gift_intent");
  if (prefs.budget != null) signals.add("budget_cap");

  return {
    archetype,
    theme,
    card: { ...preset.card },
    header: { ...preset.header },
    hero,
    sections,
    listing: { ...preset.listing },
    product: { ...preset.product },
    highlights,
    signals: [...signals],
  };
}
