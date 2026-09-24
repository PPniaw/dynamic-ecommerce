import type { Product, Profile, User } from "../../shared/decision.ts";

export interface DecisionInput {
  user: User;
  profile: Profile;
  products: Product[];
  recentIds: string[];
  cartIds: string[];
  trigger: string;
}
