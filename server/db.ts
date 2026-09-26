// SQLite via node's built-in `node:sqlite` — no native build step, one file on
// disk (`data/shop-v2.db`). Swap for Postgres later by replacing this module;
// nothing else touches SQL.
//
// v2 lives in a new file on purpose: the v1 `data/shop.db` has a different
// products table (emoji, base_price) and v1 prefs, and CREATE TABLE IF NOT
// EXISTS would silently keep the old shape.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import type { CartLine, EventType, User, UserPrefs } from "../shared/decision.ts";
import { CATALOG, type Product, type ShopCategory } from "../shared/catalog.ts";
import { EMPTY_PERSONA } from "../shared/personas.ts";
import { SEED_USERS } from "./seed.ts";

mkdirSync("data", { recursive: true });
export const db = new DatabaseSync(process.env.DB_PATH ?? "data/shop-v2.db");
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  maker TEXT NOT NULL,
  category TEXT NOT NULL,
  price INTEGER NOT NULL,
  list_price INTEGER NOT NULL,
  stock INTEGER NOT NULL,
  image TEXT NOT NULL,
  tags TEXT NOT NULL,
  is_new INTEGER NOT NULL DEFAULT 0,
  sold INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  prefs TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  product_id TEXT,
  meta TEXT,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS events_user_ts ON events(user_id, ts);
CREATE TABLE IF NOT EXISTS cart_items (
  user_id TEXT NOT NULL REFERENCES users(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  qty INTEGER NOT NULL,
  price_at_add INTEGER NOT NULL,
  PRIMARY KEY (user_id, product_id)
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  total INTEGER NOT NULL,
  ts INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS order_items (
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  qty INTEGER NOT NULL,
  price INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  source TEXT NOT NULL,
  trigger TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  body TEXT NOT NULL,
  ts INTEGER NOT NULL
);
`);

// ---- seed ------------------------------------------------------------------

const productCount = (db.prepare("SELECT COUNT(*) AS n FROM products").get() as { n: number }).n;
if (productCount === 0) {
  const ins = db.prepare(
    "INSERT INTO products (id,name,maker,category,price,list_price,stock,image,tags,is_new) VALUES (?,?,?,?,?,?,?,?,?,?)",
  );
  // list_price is the reference every price move is measured against; a
  // catalog `compareAt` means "already on sale at seed time".
  for (const p of CATALOG) {
    ins.run(p.id, p.name, p.maker, p.category, p.price, p.compareAt ?? p.price, p.stock, p.image, JSON.stringify(p.tags), p.isNew ? 1 : 0);
  }
  const insU = db.prepare("INSERT INTO users (id,name,prefs) VALUES (?,?,?)");
  for (const u of SEED_USERS) insU.run(u.id, u.name, JSON.stringify(u.prefs));
}
// Databases seeded before the rename: the visitor is "你", not "新訪客".
db.prepare("UPDATE users SET name = '你' WHERE id = 'u_new' AND name = '新訪客'").run();

// ---- products --------------------------------------------------------------

interface ProductRow {
  id: string; name: string; maker: string; category: string; price: number; list_price: number;
  stock: number; image: string; tags: string; is_new: number; sold: number;
}

// The shared `Product` shape: `compareAt` exists only while the live price is
// below list price, so "is it on sale" is `p.compareAt !== undefined` everywhere.
const toProduct = (r: ProductRow): Product => ({
  id: r.id, name: r.name, maker: r.maker, category: r.category as ShopCategory,
  price: r.price, ...(r.price < r.list_price ? { compareAt: r.list_price } : {}),
  stock: r.stock, image: r.image, tags: JSON.parse(r.tags),
  ...(r.is_new ? { isNew: true } : {}), sold: r.sold,
});

// List price isn't part of the shared Product (it's implied by compareAt only
// while discounted); the market simulator and the Claude prompt need it always.
export function listPrices(): Map<string, number> {
  return new Map((db.prepare("SELECT id, list_price FROM products").all() as unknown as { id: string; list_price: number }[])
    .map((r) => [r.id, r.list_price]));
}

export function listProducts(): Product[] {
  return (db.prepare("SELECT * FROM products ORDER BY id").all() as unknown as ProductRow[]).map(toProduct);
}

export function getProduct(id: string): Product | undefined {
  const r = db.prepare("SELECT * FROM products WHERE id = ?").get(id) as ProductRow | undefined;
  return r && toProduct(r);
}

export function updateProduct(id: string, patch: { price?: number; stock?: number; soldDelta?: number }) {
  const p = getProduct(id);
  if (!p) return;
  db.prepare("UPDATE products SET price = ?, stock = ?, sold = sold + ? WHERE id = ?").run(
    patch.price ?? p.price, patch.stock ?? p.stock, patch.soldDelta ?? 0, id,
  );
}

// ---- users -----------------------------------------------------------------

const DEFAULT_PREFS: UserPrefs = {
  archetype: "auto", scheme: "auto", vibe: "auto", budget: null, categories: [], need: "", persona: EMPTY_PERSONA,
};

type UserRow = { id: string; name: string; prefs: string };
const toUser = (r: UserRow): User => {
  const p = JSON.parse(r.prefs) as Partial<UserPrefs>;
  return { id: r.id, name: r.name, prefs: { ...DEFAULT_PREFS, ...p, persona: { ...EMPTY_PERSONA, ...p.persona } } };
};

export function listUsers(): User[] {
  return (db.prepare("SELECT * FROM users ORDER BY rowid").all() as unknown as UserRow[]).map(toUser);
}

export function getUser(id: string): User | undefined {
  const r = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  return r && toUser(r);
}

export function createUser(name: string): User {
  const id = `u_${crypto.randomUUID().slice(0, 8)}`;
  db.prepare("INSERT INTO users (id,name,prefs) VALUES (?,?,?)").run(id, name, JSON.stringify(DEFAULT_PREFS));
  return getUser(id)!;
}

export function setPrefs(id: string, prefs: UserPrefs) {
  db.prepare("UPDATE users SET prefs = ? WHERE id = ?").run(JSON.stringify(prefs), id);
}

// ---- events ----------------------------------------------------------------

export interface EventRow {
  type: EventType; product_id: string | null; meta: string | null; ts: number;
}

export function logEvent(userId: string, type: EventType, productId?: string, meta?: unknown) {
  db.prepare("INSERT INTO events (user_id,type,product_id,meta,ts) VALUES (?,?,?,?,?)").run(
    userId, type, productId ?? null, meta === undefined ? null : JSON.stringify(meta), Date.now(),
  );
}

export function recentEvents(userId: string, limit = 200): EventRow[] {
  return db.prepare("SELECT type, product_id, meta, ts FROM events WHERE user_id = ? ORDER BY ts DESC LIMIT ?")
    .all(userId, limit) as unknown as EventRow[];
}

// ---- cart & orders ---------------------------------------------------------

export function getCart(userId: string): CartLine[] {
  return (db.prepare("SELECT product_id, qty, price_at_add FROM cart_items WHERE user_id = ? ORDER BY rowid")
    .all(userId) as unknown as { product_id: string; qty: number; price_at_add: number }[])
    .map((r) => ({ productId: r.product_id, qty: r.qty, priceAtAdd: r.price_at_add }));
}

export function setCartQty(userId: string, productId: string, qty: number) {
  if (qty <= 0) {
    db.prepare("DELETE FROM cart_items WHERE user_id = ? AND product_id = ?").run(userId, productId);
    return;
  }
  const p = getProduct(productId);
  if (!p) throw new Error("no such product");
  // price_at_add is only set on first add — that's what lets the cart show
  // "price dropped since you added it".
  db.prepare(`INSERT INTO cart_items (user_id,product_id,qty,price_at_add) VALUES (?,?,?,?)
              ON CONFLICT(user_id,product_id) DO UPDATE SET qty = excluded.qty`)
    .run(userId, productId, qty, p.price);
}

export class CheckoutError extends Error {
  constructor(public code: "empty" | "out_of_stock", public productId?: string) { super(code); }
}

// Stock check and decrement happen in one transaction: two shoppers racing
// for the last unit can't both win.
export function checkout(userId: string): { orderId: number; total: number; touched: string[] } {
  const lines = getCart(userId);
  if (lines.length === 0) throw new CheckoutError("empty");
  db.exec("BEGIN IMMEDIATE");
  try {
    let total = 0;
    for (const l of lines) {
      const p = getProduct(l.productId)!;
      if (p.stock < l.qty) throw new CheckoutError("out_of_stock", p.id);
      total += p.price * l.qty; // charge the *current* price, not price_at_add
    }
    const { lastInsertRowid } = db.prepare("INSERT INTO orders (user_id,total,ts) VALUES (?,?,?)").run(userId, total, Date.now());
    const orderId = Number(lastInsertRowid);
    for (const l of lines) {
      const p = getProduct(l.productId)!;
      db.prepare("INSERT INTO order_items (order_id,product_id,qty,price) VALUES (?,?,?,?)").run(orderId, p.id, l.qty, p.price);
      db.prepare("UPDATE products SET stock = stock - ?, sold = sold + ? WHERE id = ?").run(l.qty, l.qty, p.id);
    }
    db.prepare("DELETE FROM cart_items WHERE user_id = ?").run(userId);
    db.exec("COMMIT");
    return { orderId, total, touched: lines.map((l) => l.productId) };
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function listOrders(userId: string) {
  const orders = db.prepare("SELECT id, total, ts FROM orders WHERE user_id = ? ORDER BY ts DESC LIMIT 20")
    .all(userId) as unknown as { id: number; total: number; ts: number }[];
  return orders.map((o) => ({
    ...o,
    items: db.prepare("SELECT product_id AS productId, qty, price FROM order_items WHERE order_id = ?").all(o.id),
  }));
}

export function saveDecision(userId: string, source: string, trigger: string, latencyMs: number, body: unknown) {
  db.prepare("INSERT INTO decisions (user_id,source,trigger,latency_ms,body,ts) VALUES (?,?,?,?,?,?)")
    .run(userId, source, trigger, latencyMs, JSON.stringify(body), Date.now());
}

// ---- stats (the /stats.html page) -------------------------------------------
// Raw rows for server/stats.ts. Demo shoppers are filtered there.

export function statsRows(sinceTs: number) {
  return {
    users: db.prepare("SELECT id, prefs FROM users").all() as unknown as { id: string; prefs: string }[],
    // First and last time each shopper made the store re-decide.
    seen: db.prepare("SELECT user_id, MIN(ts) AS first, MAX(ts) AS last, SUM(trigger = 'chat') AS chats FROM decisions GROUP BY user_id")
      .all() as unknown as { user_id: string; first: number; last: number; chats: number }[],
    // Each shopper's latest store.
    latest: db.prepare(`SELECT d.user_id, d.body FROM decisions d
      JOIN (SELECT user_id, MAX(id) AS mid FROM decisions GROUP BY user_id) m ON d.id = m.mid`)
      .all() as unknown as { user_id: string; body: string }[],
    recent: db.prepare("SELECT user_id, source, trigger, ts FROM decisions WHERE ts >= ?")
      .all(sinceTs) as unknown as { user_id: string; source: string; trigger: string; ts: number }[],
    orders: db.prepare("SELECT user_id, total, ts FROM orders").all() as unknown as { user_id: string; total: number; ts: number }[],
  };
}
