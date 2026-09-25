// Profile building lives in shared/profile.ts (the static preview runs the
// same code in the browser); this adapts SQLite rows to it.
import type { Profile } from "../shared/decision.ts";
import type { Product } from "../shared/catalog.ts";
import { profileFrom, recentIdsFrom, type ProfileEvent } from "../shared/profile.ts";
import { getCart, recentEvents } from "./db.ts";

export const events = (userId: string, limit?: number): ProfileEvent[] =>
  recentEvents(userId, limit).map((e) => ({ type: e.type, productId: e.product_id, ts: e.ts }));

export function buildProfile(userId: string, products: Product[]): Profile {
  return profileFrom(events(userId), getCart(userId), products);
}

export function recentProductIds(userId: string, n = 8): string[] {
  return recentIdsFrom(events(userId, 50), n);
}
