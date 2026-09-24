import express from "express";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { WebSocketServer, type WebSocket } from "ws";
import type { ActivityItem, DecisionEnvelope, EventType, ServerMessage, UserPrefs } from "../shared/decision.ts";
import { ARCHETYPES } from "../shared/decision.ts";
import { SHOP_CATEGORIES } from "../shared/catalog.ts";
import { INTERESTS, MBTI_TYPES, TRAITS, ZODIACS, type Persona } from "../shared/personas.ts";
import {
  checkout, CheckoutError, createUser, getCart, getProduct, getUser, listOrders, listPrices,
  listProducts, listUsers, logEvent, saveDecision, setCartQty, setPrefs, updateProduct,
} from "./db.ts";
import { decide, decideWithRules, sanitize, type DecisionInput } from "./decision/index.ts";
import { claudeEnabled } from "./decision/claude.ts";
import { buildProfile, recentProductIds } from "./profile.ts";

const PORT = Number(process.env.PORT ?? 8787);
const app = express();
app.use(express.json());

// ---- sockets ---------------------------------------------------------------

const sockets = new Map<string, Set<WebSocket>>();
const send = (ws: WebSocket, m: ServerMessage) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(m));
const toUser = (userId: string, m: ServerMessage) => sockets.get(userId)?.forEach((ws) => send(ws, m));
const toAll = (m: ServerMessage) => sockets.forEach((set) => set.forEach((ws) => send(ws, m)));

// ---- decision scheduling ---------------------------------------------------
//
// Shoppers click fast; the model is not instant. Per user we keep at most one
// decision in flight, debounce bursts of events into one call, and if events
// arrive mid-flight we run exactly once more afterwards with the newest state.

interface Sched { timer?: NodeJS.Timeout; inFlight: boolean; pending?: string; lastMarketRun: number }
const sched = new Map<string, Sched>();
const latest = new Map<string, DecisionEnvelope>();
const DEBOUNCE_MS = 900;
// Market moves are frequent and not caused by the shopper; cap how often they
// can cost an LLM call.
const MARKET_REDECIDE_MIN_MS = 20_000;

function buildInput(userId: string, trigger: string): DecisionInput | undefined {
  const user = getUser(userId);
  if (!user) return;
  const products = listProducts();
  return {
    user, products, trigger,
    listPrices: listPrices(),
    profile: buildProfile(userId, products),
    recentIds: recentProductIds(userId),
    cartIds: getCart(userId).map((l) => l.productId),
  };
}

function requestDecision(userId: string, trigger: string, delay = DEBOUNCE_MS) {
  const s = sched.get(userId) ?? { inFlight: false, lastMarketRun: 0 };
  sched.set(userId, s);
  if (s.inFlight) { s.pending = trigger; return; }
  clearTimeout(s.timer);
  s.timer = setTimeout(() => void run(userId, trigger), delay);
}

async function run(userId: string, trigger: string) {
  const s = sched.get(userId)!;
  const input = buildInput(userId, trigger);
  if (!input) return;
  s.inFlight = true;
  toUser(userId, { type: "deciding", trigger });
  try {
    const env = await decide(input);
    latest.set(userId, env);
    saveDecision(userId, env.source, trigger, env.latencyMs, env.decision);
    toUser(userId, { type: "decision", envelope: env });
    console.log(`[decide] ${userId} ${trigger} → ${env.source} ${env.latencyMs}ms`);
  } finally {
    s.inFlight = false;
    if (s.pending) {
      const next = s.pending;
      s.pending = undefined;
      requestDecision(userId, next, 0);
    }
  }
}

// ---- market simulator ------------------------------------------------------
//
// Stands in for "other shoppers" so the store is visibly alive: sales drain
// stock, restocks refill it, flash prices come and go. Prices always move
// relative to list price, so a product is "on sale" (has compareAt) exactly
// when a step below 1 is in effect.

const PRICE_STEPS = [0.7, 0.8, 0.85, 0.9, 1, 1, 1.1];
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

function marketTick() {
  const products = listProducts();
  const list = listPrices();
  const r = Math.random();
  let item: ActivityItem | undefined;
  if (r < 0.6) {
    const p = pick(products.filter((x) => x.stock > 0));
    if (!p) return;
    const qty = Math.min(p.stock, 1 + Math.floor(Math.random() * 3));
    updateProduct(p.id, { stock: p.stock - qty, soldDelta: qty });
    item = { kind: p.stock - qty === 0 ? "sold_out" : "sold", productId: p.id, qty, at: Date.now() };
  } else if (r < 0.7) {
    const p = pick(products.filter((x) => x.stock < 5)) ?? pick(products);
    updateProduct(p.id, { stock: p.stock + 15 });
    item = { kind: "restock", productId: p.id, qty: 15, at: Date.now() };
  } else {
    const p = pick(products);
    const to = Math.round((list.get(p.id)! * pick(PRICE_STEPS)) / 10) * 10;
    if (to === p.price) return;
    updateProduct(p.id, { price: to });
    item = { kind: to < p.price ? "price_drop" : "price_up", productId: p.id, from: p.price, to, at: Date.now() };
  }
  const changed = getProduct(item.productId)!;
  toAll({ type: "products", products: [changed] });
  toAll({ type: "activity", item });

  // Only re-decide for shoppers whose storefront this actually affects: a
  // price drop counts once it's at least 10% under list.
  const material = item.kind === "sold_out" || item.kind === "restock"
    || (item.kind === "price_drop" && item.to! <= list.get(changed.id)! * 0.9);
  if (!material) return;
  for (const userId of sockets.keys()) {
    const env = latest.get(userId);
    const shown = env && (env.decision.hero.productIds.includes(item.productId)
      || env.decision.sections.slice(0, 2).some((s) => s.productIds.includes(item.productId)));
    const s = sched.get(userId);
    const cooled = !s || Date.now() - s.lastMarketRun > MARKET_REDECIDE_MIN_MS;
    if ((shown || item.kind === "price_drop") && cooled) {
      if (s) s.lastMarketRun = Date.now();
      else sched.set(userId, { inFlight: false, lastMarketRun: Date.now() });
      requestDecision(userId, `market:${item.kind}`);
    }
  }
}
setInterval(marketTick, Number(process.env.MARKET_TICK_MS ?? 2500));

// ---- REST ------------------------------------------------------------------

app.get("/api/meta", (_req, res) => { res.json({ claude: claudeEnabled() }); });
app.get("/api/products", (_req, res) => { res.json(listProducts()); });
app.get("/api/users", (_req, res) => { res.json(listUsers()); });

app.post("/api/users", (req, res) => {
  const name = String(req.body?.name ?? "").trim().slice(0, 30) || "新朋友";
  res.json(createUser(name));
});

// Full UserPrefs v2 from an untrusted body. Every enum is checked against the
// shared vocabularies; unknown values are dropped, not rejected, so an older
// client can't wipe a field by sending something we don't know.
const oneOf = <T extends string>(xs: readonly T[], v: unknown): T | null =>
  typeof v === "string" && (xs as readonly string[]).includes(v) ? (v as T) : null;
const someOf = <T extends string>(xs: readonly T[], v: unknown, max = xs.length): T[] =>
  Array.isArray(v) ? [...new Set(v.map((x) => oneOf(xs, x)).filter((x): x is T => x !== null))].slice(0, max) : [];

function parsePrefs(b: Record<string, unknown>): UserPrefs {
  const p = (b.persona && typeof b.persona === "object" ? b.persona : {}) as Record<string, unknown>;
  const persona: Persona = {
    mbti: oneOf(MBTI_TYPES, p.mbti),
    zodiac: oneOf(ZODIACS, p.zodiac),
    traits: someOf(TRAITS, p.traits),
    interests: someOf(INTERESTS, p.interests),
  };
  const budget = Number(b.budget);
  return {
    archetype: oneOf(["auto", ...ARCHETYPES] as const, b.archetype) ?? "auto",
    scheme: oneOf(["auto", "light", "dark"] as const, b.scheme) ?? "auto",
    budget: b.budget != null && Number.isFinite(budget) && budget > 0 ? Math.round(budget) : null,
    categories: someOf(SHOP_CATEGORIES, b.categories),
    need: String(b.need ?? "").slice(0, 200),
    persona,
  };
}

app.put("/api/users/:id/prefs", (req, res) => {
  const user = getUser(req.params.id);
  if (!user) { res.status(404).end(); return; }
  const prefs = parsePrefs(req.body ?? {});
  setPrefs(user.id, prefs);
  const updated = { ...user, prefs };
  // Other tabs of the same shopper see the new persona / prefs right away.
  toUser(user.id, { type: "user", user: updated });
  requestDecision(user.id, "prefs", 0);
  res.json(updated);
});

app.get("/api/users/:id/profile", (req, res) => {
  if (!getUser(req.params.id)) { res.status(404).end(); return; }
  res.json(buildProfile(req.params.id, listProducts()));
});

const EVENT_TYPES: EventType[] = ["view", "favorite", "search"];
app.post("/api/events", (req, res) => {
  const { userId, type, productId, meta } = req.body ?? {};
  if (!getUser(userId) || !EVENT_TYPES.includes(type)) { res.status(400).end(); return; }
  logEvent(userId, type, productId, meta);
  requestDecision(userId, type);
  res.status(204).end();
});

app.get("/api/users/:id/cart", (req, res) => { res.json(getCart(req.params.id)); });

app.put("/api/users/:id/cart/:productId", (req, res) => {
  const { id, productId } = req.params;
  const qty = Math.max(0, Math.min(99, Number(req.body?.qty) || 0));
  if (!getUser(id) || !getProduct(productId)) { res.status(404).end(); return; }
  const before = getCart(id).find((l) => l.productId === productId)?.qty ?? 0;
  setCartQty(id, productId, qty);
  logEvent(id, qty > before ? "add_to_cart" : "remove_from_cart", productId);
  const lines = getCart(id);
  toUser(id, { type: "cart", lines });
  requestDecision(id, qty > before ? "add_to_cart" : "remove_from_cart");
  res.json(lines);
});

app.post("/api/users/:id/checkout", (req, res) => {
  const id = req.params.id;
  try {
    const r = checkout(id);
    for (const pid of r.touched) logEvent(id, "purchase", pid);
    toAll({ type: "products", products: r.touched.map((pid) => getProduct(pid)!) });
    toUser(id, { type: "cart", lines: [] });
    requestDecision(id, "purchase");
    res.json(r);
  } catch (e) {
    if (e instanceof CheckoutError) { res.status(409).json({ error: e.code, productId: e.productId }); return; }
    throw e;
  }
});

app.get("/api/users/:id/orders", (req, res) => { res.json(listOrders(req.params.id)); });

if (existsSync("dist")) {
  app.use(express.static("dist"));
  app.get(/^\/(?!api|ws).*/, (_req, res) => { res.sendFile("index.html", { root: "dist" }); });
}

// ---- websocket -------------------------------------------------------------

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
  const userId = new URL(req.url ?? "", "http://x").searchParams.get("userId") ?? "";
  const user = getUser(userId);
  if (!user) { ws.close(4004, "unknown user"); return; }
  if (!sockets.has(userId)) sockets.set(userId, new Set());
  sockets.get(userId)!.add(ws);

  send(ws, { type: "hello", products: listProducts(), user });
  send(ws, { type: "cart", lines: getCart(userId) });

  // First paint: the last decision if we have one, otherwise the rule engine's
  // answer immediately — then let Claude improve on it in the background.
  const cached = latest.get(userId);
  if (cached) send(ws, { type: "decision", envelope: cached });
  else {
    const input = buildInput(userId, "open")!;
    const t0 = Date.now();
    const env: DecisionEnvelope = { decision: sanitize(decideWithRules(input), input.products), source: "rules", latencyMs: Date.now() - t0, at: Date.now(), trigger: "open" };
    latest.set(userId, env);
    send(ws, { type: "decision", envelope: env });
    if (claudeEnabled()) requestDecision(userId, "open", 0);
  }

  ws.on("close", () => {
    const set = sockets.get(userId);
    set?.delete(ws);
    if (set?.size === 0) sockets.delete(userId);
  });
});

server.listen(PORT, () => {
  console.log(`[shop] http://localhost:${PORT}  decision engine: ${claudeEnabled() ? "Claude" : "rules (set ANTHROPIC_API_KEY for Claude)"}`);
});
