import type { ChatResult, ChatTurn } from "../../../shared/chat";
import type { CartLine, Profile, User, UserPrefs } from "../../../shared/decision";

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status, body: await res.json().catch(() => null) });
  return res.status === 204 ? (undefined as T) : res.json();
}
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export interface Order { id: number; total: number; ts: number; items: { productId: string; qty: number; price: number }[] }

export const api = {
  meta: () => fetch("/api/meta").then(j<{ claude: boolean }>),
  users: () => fetch("/api/users").then(j<User[]>),
  createUser: (name: string) => fetch("/api/users", json("POST", { name })).then(j<User>),
  setPrefs: (id: string, prefs: UserPrefs) => fetch(`/api/users/${id}/prefs`, json("PUT", prefs)).then(j<User>),
  chat: (id: string, text: string, history: ChatTurn[]) => fetch(`/api/users/${id}/chat`, json("POST", { text, history })).then(j<ChatResult>),
  profile: (id: string) => fetch(`/api/users/${id}/profile`).then(j<Profile>),
  event: (userId: string, type: "view" | "favorite" | "search", productId?: string, meta?: unknown) =>
    fetch("/api/events", json("POST", { userId, type, productId, meta })).then(j<void>),
  setQty: (id: string, productId: string, qty: number) => fetch(`/api/users/${id}/cart/${productId}`, json("PUT", { qty })).then(j<CartLine[]>),
  checkout: (id: string) => fetch(`/api/users/${id}/checkout`, { method: "POST" }).then(j<{ orderId: number; total: number }>),
  orders: (id: string) => fetch(`/api/users/${id}/orders`).then(j<Order[]>),
};
