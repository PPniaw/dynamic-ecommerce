// Decision schema v2 — the storefront is a *decision*, not a page of copy.
//
// The top-level choice is the ARCHETYPE: four structurally different stores
// (editorial / collage / index / deal), each with its own header, hero,
// section renderers, card style, category page and product page. Personality
// changes the kind of store you walk into, not just its colours.
//
// Every field is an enum or a product id. The LLM decides; it never writes the
// words (all copy lives in web/src/store/copy.ts, keyed by these enums).
// Every engine (jev, Claude, rules) produces this same shape.
import { z } from "zod/v4";
import { SHOP_CATEGORIES, type Product } from "./catalog.ts";
import type { Persona } from "./personas.ts";

export const ARCHETYPES = ["editorial", "collage", "index", "deal"] as const;
export type Archetype = (typeof ARCHETYPES)[number];

export const PALETTE_NAMES = ["ink", "sand", "sage", "blush", "night", "oat"] as const;
export const SURFACES = ["page", "subtle", "inverse", "accent"] as const;

// What a section is *for* — decides its title (copy.ts) and what goes in it.
export const INTENTS = [
  "for_you", "trending", "deals", "low_stock", "because_viewed", "budget_picks",
  "gift_ideas", "new_arrivals", "maker_story", "category",
] as const;

export const HEADLINES = [
  "slow_living", "made_by_hand", "new_this_week", "for_you", "gift_season",
  "deals_now", "last_chance", "the_index", "weekend_adventure",
] as const;

export const BADGES = ["for_you", "trending", "new"] as const;

export const SIGNALS = [
  "cold_start", "persona_introvert", "persona_extrovert", "persona_feeling", "persona_thinking",
  "persona_practical", "persona_curious", "zodiac_element", "interest_match", "category_affinity",
  "price_sensitive", "premium_taste", "cart_intent", "stock_urgency", "price_drop",
  "explicit_need", "gift_intent", "budget_cap", "night_owl",
] as const;

export const ThemeSchema = z.object({
  palette: z.enum(PALETTE_NAMES),
  scheme: z.enum(["light", "dark"]),
  fonts: z.enum(["modern", "editorial", "friendly", "literary"]),
  typeScale: z.enum(["compact", "normal", "display"]),
  headingCase: z.enum(["none", "uppercase"]),
  radius: z.enum(["sharp", "soft", "round", "pill"]),
  density: z.enum(["tight", "normal", "airy"]),
  pageWidth: z.enum(["narrow", "normal", "wide"]),
  hoverEffect: z.enum(["none", "lift", "scale", "zoom"]),
  elevation: z.enum(["flat", "soft"]),
});

export const CardSchema = z.object({
  variant: z.enum(["standard", "sticker", "deal"]),
  imageRatio: z.enum(["portrait", "square", "landscape"]),
  hover: z.enum(["none", "second_image", "zoom"]),
  quickAdd: z.boolean(),
  info: z.enum(["stacked", "row", "overlay"]),
  badgePosition: z.enum(["top-left", "top-right", "bottom-left"]),
  frame: z.enum(["bare", "card"]),
});

export const RAIL_LAYOUTS = ["grid", "carousel", "editorial", "table", "bento", "dense"] as const;

export const DecisionSchema = z.object({
  archetype: z.enum(ARCHETYPES),
  theme: ThemeSchema,
  card: CardSchema,
  header: z.object({
    variant: z.enum(["centered", "bubbly", "bar", "utility"]),
    announcement: z.enum(["none", "free_shipping", "flash_sale", "new_arrivals", "maker_week"]),
  }),
  hero: z.object({
    variant: z.enum(["spread", "collage", "ledger", "flash", "minimal"]),
    headline: z.enum(HEADLINES),
    productIds: z.array(z.string()),
  }),
  sections: z.array(z.object({
    kind: z.enum(["rail", "story", "marquee", "categories", "promo", "ticker"]),
    layout: z.enum(RAIL_LAYOUTS),
    intent: z.enum(INTENTS),
    category: z.enum([...SHOP_CATEGORIES, "none"]),
    surface: z.enum(SURFACES),
    productIds: z.array(z.string()),
  })),
  // Category and product pages follow the archetype too.
  listing: z.object({ layout: z.enum(RAIL_LAYOUTS), filters: z.enum(["sidebar", "topbar", "none"]) }),
  product: z.object({ gallery: z.enum(["stack", "carousel", "grid"]), info: z.enum(["story", "specs", "buybox"]) }),
  // Recommendation badges only. Sold out / sale / low stock are computed.
  highlights: z.array(z.object({ productId: z.string(), badge: z.enum(BADGES) })),
  signals: z.array(z.enum(SIGNALS)),
});

export type Decision = z.infer<typeof DecisionSchema>;
export type Section = Decision["sections"][number];
export type RailLayout = (typeof RAIL_LAYOUTS)[number];
export type DecisionSource = "jev" | "claude" | "rules";
// The model-backed engines. "rules" is always there as the fallback.
export type LlmEngine = Exclude<DecisionSource, "rules">;

export interface DecisionEnvelope {
  decision: Decision;
  source: DecisionSource;
  latencyMs: number;
  at: number;
  // What caused this re-decision (an event type, "prefs", or a market change).
  trigger: string;
}

// ---- users -----------------------------------------------------------------

export interface UserPrefs {
  archetype: "auto" | Archetype;
  scheme: "auto" | "light" | "dark";
  budget: number | null;
  categories: (typeof SHOP_CATEGORIES)[number][];
  // Free-form need, e.g. "送同事的生日禮物". Input to the model; output stays enums.
  need: string;
  persona: Persona;
}

export interface User {
  id: string;
  name: string;
  prefs: UserPrefs;
}

export interface Profile {
  affinity: Record<(typeof SHOP_CATEGORIES)[number], number>;
  avgViewedPrice: number | null;
  topTags: string[];
  eventCount: number;
  cartValue: number;
  dealClicks: number;
}

export interface CartLine {
  productId: string;
  qty: number;
  priceAtAdd: number;
}

export type EventType = "view" | "favorite" | "add_to_cart" | "remove_from_cart" | "search" | "purchase";

export interface ActivityItem {
  kind: "sold" | "restock" | "price_drop" | "price_up" | "sold_out";
  productId: string;
  qty?: number;
  from?: number;
  to?: number;
  at: number;
}

// Server → client messages over the websocket.
export type ServerMessage =
  | { type: "hello"; products: Product[]; user: User }
  | { type: "products"; products: Product[] }
  | { type: "deciding"; trigger: string }
  | { type: "decision"; envelope: DecisionEnvelope }
  | { type: "cart"; lines: CartLine[] }
  | { type: "activity"; item: ActivityItem }
  | { type: "user"; user: User };
