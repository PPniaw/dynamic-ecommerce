// The four stores. Each archetype is a *designed* combination of theme,
// card, header, hero, section layouts and page templates — the starting point
// both engines work from. The rule engine applies it (plus persona tweaks);
// Claude gets it as a reference and may deviate field by field.
import type { Archetype, Decision } from "./decision.ts";
import { ZODIAC_ELEMENT, type Persona } from "./personas.ts";

type Preset = Pick<Decision, "theme" | "card" | "header" | "listing" | "product"> & {
  hero: Pick<Decision["hero"], "variant" | "headline">;
  // Default section rhythm: kind + layout + intent + surface, filled with products by the engine.
  rhythm: Omit<Decision["sections"][number], "productIds" | "category">[];
};

export const ARCHETYPE_PRESETS: Record<Archetype, Preset> = {
  // 文藝收藏者:慢、故事、手作。雜誌跨頁、大圖、襯線、大量留白。
  editorial: {
    theme: { palette: "oat", scheme: "light", fonts: "editorial", typeScale: "display", headingCase: "none", radius: "sharp", density: "airy", pageWidth: "normal", hoverEffect: "zoom", elevation: "flat" },
    card: { variant: "standard", imageRatio: "portrait", hover: "second_image", quickAdd: false, info: "stacked", badgePosition: "bottom-left", frame: "bare" },
    header: { variant: "centered", announcement: "maker_week" },
    hero: { variant: "spread", headline: "made_by_hand" },
    rhythm: [
      { kind: "rail", layout: "editorial", intent: "for_you", surface: "page" },
      { kind: "story", layout: "editorial", intent: "maker_story", surface: "subtle" },
      { kind: "rail", layout: "grid", intent: "new_arrivals", surface: "page" },
      { kind: "categories", layout: "grid", intent: "category", surface: "page" },
    ],
    listing: { layout: "editorial", filters: "none" },
    product: { gallery: "stack", info: "story" },
  },
  // 熱情探險家:好奇、衝動、喜歡驚喜。貼紙、拼貼、跑馬燈、圓體。
  collage: {
    theme: { palette: "blush", scheme: "light", fonts: "friendly", typeScale: "display", headingCase: "none", radius: "pill", density: "normal", pageWidth: "wide", hoverEffect: "lift", elevation: "soft" },
    card: { variant: "sticker", imageRatio: "square", hover: "zoom", quickAdd: true, info: "stacked", badgePosition: "top-right", frame: "card" },
    header: { variant: "bubbly", announcement: "new_arrivals" },
    hero: { variant: "collage", headline: "weekend_adventure" },
    rhythm: [
      { kind: "marquee", layout: "carousel", intent: "trending", surface: "accent" },
      { kind: "rail", layout: "bento", intent: "for_you", surface: "page" },
      { kind: "categories", layout: "bento", intent: "category", surface: "subtle" },
      { kind: "rail", layout: "carousel", intent: "new_arrivals", surface: "page" },
      { kind: "ticker", layout: "carousel", intent: "trending", surface: "inverse" },
    ],
    listing: { layout: "bento", filters: "topbar" },
    product: { gallery: "carousel", info: "story" },
  },
  // 理性比較者:規格、索引、資訊密度。表格、編號、銳角、無裝飾。
  index: {
    theme: { palette: "ink", scheme: "light", fonts: "modern", typeScale: "compact", headingCase: "uppercase", radius: "sharp", density: "tight", pageWidth: "wide", hoverEffect: "none", elevation: "flat" },
    card: { variant: "standard", imageRatio: "square", hover: "none", quickAdd: true, info: "row", badgePosition: "top-left", frame: "bare" },
    header: { variant: "bar", announcement: "none" },
    hero: { variant: "ledger", headline: "the_index" },
    rhythm: [
      { kind: "rail", layout: "table", intent: "for_you", surface: "page" },
      { kind: "rail", layout: "grid", intent: "new_arrivals", surface: "subtle" },
      { kind: "rail", layout: "table", intent: "low_stock", surface: "page" },
    ],
    listing: { layout: "table", filters: "sidebar" },
    product: { gallery: "grid", info: "specs" },
  },
  // 務實比價者:趕時間、看價格。倒數、大價格、密集格線、到處都能加購物車。
  deal: {
    theme: { palette: "night", scheme: "dark", fonts: "modern", typeScale: "normal", headingCase: "uppercase", radius: "soft", density: "tight", pageWidth: "wide", hoverEffect: "lift", elevation: "soft" },
    card: { variant: "deal", imageRatio: "square", hover: "none", quickAdd: true, info: "stacked", badgePosition: "top-left", frame: "card" },
    header: { variant: "utility", announcement: "flash_sale" },
    hero: { variant: "flash", headline: "deals_now" },
    rhythm: [
      { kind: "promo", layout: "dense", intent: "deals", surface: "subtle" },
      { kind: "rail", layout: "dense", intent: "deals", surface: "page" },
      { kind: "rail", layout: "dense", intent: "budget_picks", surface: "subtle" },
      { kind: "rail", layout: "carousel", intent: "low_stock", surface: "page" },
    ],
    listing: { layout: "dense", filters: "topbar" },
    product: { gallery: "carousel", info: "buybox" },
  },
};

// Persona → archetype scores. Transparent on purpose: the lab and the
// decision panel can show *why* a shopper got the store they got.
export function scoreArchetypes(p: Persona, dealClicks = 0, hasBudget = false): Record<Archetype, number> {
  const s: Record<Archetype, number> = { editorial: 0, collage: 0, index: 0, deal: 0 };
  const m = p.mbti ?? "";
  if (m) {
    if (m[0] === "I") { s.editorial += 1; s.index += 1; } else { s.collage += 1; s.deal += 1; }
    if (m[1] === "N") { s.editorial += 1; s.collage += 1; s.index += 0.5; } else { s.deal += 1.5; }
    if (m[2] === "F") { s.editorial += 1.5; s.collage += 1.5; } else { s.index += 2; s.deal += 1; }
    if (m[3] === "P") { s.collage += 1; } else { s.index += 0.5; s.deal += 1; }
  }
  if (p.zodiac) {
    const e = ZODIAC_ELEMENT[p.zodiac];
    s[({ fire: "collage", earth: "deal", air: "index", water: "editorial" } as const)[e]] += 1;
  }
  const t = new Set<string>([...p.traits, ...p.interests]);
  const add = (a: Archetype, n: number, ...keys: string[]) => { for (const k of keys) if (t.has(k)) s[a] += n; };
  add("editorial", 1.2, "慢活", "念舊", "感性", "閱讀", "陶藝", "茶", "手沖咖啡", "香氛");
  add("collage", 1.2, "好奇", "衝動", "愛冒險", "外向", "露營", "音樂祭", "攝影", "植物");
  add("index", 1.2, "理性", "重設計", "鋼筆", "設計", "手帳", "內向");
  add("deal", 1.2, "務實", "比價", "通勤", "送禮", "愛送禮");
  s.deal += Math.min(dealClicks, 6) * 0.5 + (hasBudget ? 1 : 0);
  return s;
}

export function pickArchetype(scores: Record<Archetype, number>, fallback: Archetype = "editorial"): Archetype {
  const [best, v] = (Object.entries(scores) as [Archetype, number][]).sort((a, b) => b[1] - a[1])[0];
  return v > 0 ? best : fallback;
}
