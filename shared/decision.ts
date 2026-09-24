// The storefront is a *decision*, not a page of copy.
//
// Every field here is an enum or a product id. That is deliberate: the LLM
// decides what to show, in what order, in what style — it never writes the
// words. All user-facing text lives in `web/src/copy.ts`, keyed by these enums.
// That keeps the output cheap, fast, fully validatable, and impossible to
// hallucinate a price or a promise into.
//
// The same schema is produced by the Claude engine and the rule engine, so the
// frontend never knows (or cares) which one ran.
import { z } from "zod/v4";

export const CATEGORIES = ["3c", "fashion", "home", "outdoor", "beauty", "food"] as const;
export type Category = (typeof CATEGORIES)[number];

export const PRIMARY_COLORS = [
  "blue", "indigo", "violet", "grape", "pink", "red",
  "orange", "yellow", "lime", "green", "teal", "cyan", "dark",
] as const;

export const SECTION_KINDS = [
  "for_you", "trending", "deals", "low_stock", "category",
  "because_viewed", "budget_picks", "gift_ideas", "premium_picks",
] as const;

export const BADGES = ["hot", "deal", "low_stock", "for_you", "new", "price_drop"] as const;

// Why the engine decided what it decided — shown in the "decision trace"
// panel. Codes, not prose.
export const SIGNALS = [
  "cold_start", "category_affinity", "price_sensitive", "premium_taste",
  "dark_preference", "minimal_style", "vivid_style", "cart_intent",
  "stock_urgency", "price_drop", "explicit_need", "gift_intent", "budget_cap",
] as const;

export const DecisionSchema = z.object({
  theme: z.object({
    primaryColor: z.enum(PRIMARY_COLORS),
    colorScheme: z.enum(["light", "dark"]),
    radius: z.enum(["xs", "sm", "md", "lg", "xl"]),
    density: z.enum(["compact", "comfortable", "spacious"]),
    font: z.enum(["sans", "serif", "rounded", "mono"]),
  }),
  hero: z.object({
    productId: z.string(),
    variant: z.enum(["spotlight", "deal", "restock_alert", "new_arrival", "gift", "last_chance"]),
  }),
  sections: z.array(
    z.object({
      kind: z.enum(SECTION_KINDS),
      category: z.enum([...CATEGORIES, "none"]),
      layout: z.enum(["grid", "carousel", "list", "compact_grid"]),
      productIds: z.array(z.string()),
    }),
  ),
  badges: z.array(z.object({ productId: z.string(), badge: z.enum(BADGES) })),
  signals: z.array(z.enum(SIGNALS)),
});

export type Decision = z.infer<typeof DecisionSchema>;
export type DecisionSource = "claude" | "rules";

export interface DecisionEnvelope {
  decision: Decision;
  source: DecisionSource;
  latencyMs: number;
  at: number;
  // Why this re-decision happened (an event type or a market change).
  trigger: string;
}

export interface Product {
  id: string;
  name: string;
  emoji: string;
  category: Category;
  price: number;
  basePrice: number;
  stock: number;
  tags: string[];
  sold: number;
}

export type StylePref = "auto" | "minimal" | "vivid" | "dark";

export interface UserPrefs {
  style: StylePref;
  budget: number | null;
  categories: Category[];
  // Free-form need, e.g. "送女友的生日禮物". This is *input* to the model;
  // the output is still enums.
  need: string;
}

export interface User {
  id: string;
  name: string;
  prefs: UserPrefs;
}

export interface Profile {
  affinity: Record<Category, number>;
  avgViewedPrice: number | null;
  topTags: string[];
  eventCount: number;
  cartValue: number;
}

export interface CartLine {
  productId: string;
  qty: number;
  priceAtAdd: number;
}

export type EventType = "view" | "favorite" | "add_to_cart" | "remove_from_cart" | "search" | "purchase";

// Server → client messages over the websocket.
export type ServerMessage =
  | { type: "hello"; products: Product[]; user: User }
  | { type: "products"; products: Product[] }
  | { type: "deciding"; trigger: string }
  | { type: "decision"; envelope: DecisionEnvelope }
  | { type: "cart"; lines: CartLine[] }
  | { type: "activity"; item: ActivityItem };

export interface ActivityItem {
  kind: "sold" | "restock" | "price_drop" | "price_up" | "sold_out";
  productId: string;
  qty?: number;
  from?: number;
  to?: number;
  at: number;
}
