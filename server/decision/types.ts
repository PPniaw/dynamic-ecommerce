import type { Product } from "../../shared/catalog.ts";
import type { Profile, User } from "../../shared/decision.ts";

export interface DecisionInput {
  user: User;
  profile: Profile;
  products: Product[];
  // id → list price. `Product` only carries it (as compareAt) while the price
  // is below list, but a price *above* list is information too (Claude sees it).
  listPrices: Map<string, number>;
  recentIds: string[];
  cartIds: string[];
  trigger: string;
}
