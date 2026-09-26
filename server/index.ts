import "./env.ts"; // first: loads .env before other modules read process.env
import express from "express";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { WebSocketServer, type WebSocket } from "ws";
import type { ActivityItem, DecisionEnvelope, EventType, ServerMessage, UserPrefs } from "../shared/decision.ts";
import { ARCHETYPES, VIBES } from "../shared/decision.ts";
import { SHOP_CATEGORIES } from "../shared/catalog.ts";
import { INTERESTS, MBTI_TYPES, TRAITS, ZODIACS, type Persona } from "../shared/personas.ts";
import {
  checkout, CheckoutError, createUser, getCart, getProduct, getUser, listOrders, listPrices,
  listProducts, listUsers, logEvent, saveDecision, setCartQty, setPrefs, updateProduct,
} from "./db.ts";
import { timingSafeEqual } from "node:crypto";
import { isVisitor } from "../shared/personas.ts";
import { buildStats } from "./stats.ts";
import { applyChatUpdate, understandByKeywords, type ChatContext, type ChatResult, type ChatTurn, type ChatUpdate } from "../shared/chat.ts";
import { chatWithClaude, claudeEnabled } from "./decision/claude.ts";
import { decide, decideWithRules, llmEnabled, sanitize, type DecisionInput } from "./decision/index.ts";
import { inferTraitsWithTypeSafe, typesafeEnabled, understandWithTypeSafe } from "./decision/typesafe.ts";
import { buildProfile, events as profileEvents, recentProductIds } from "./profile.ts";
import { applyInferred, behaviourSummary, blend, BEHAVIOUR_TRIGGERS, INFER_COOLDOWN_MS, INFER_EVERY_EVENTS, inferTraitsByRules, localHour, mergeManualPrefs, MIN_EVENTS } from "../shared/infer.ts";

const PORT = Number(process.env.PORT ?? 8787);
const app = express();
app.use(express.json());

// ---- sockets ---------------------------------------------------------------

const sockets = new Map<string, Set<WebSocket>>();
const send = (ws: WebSocket, m: ServerMessage) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(m));
const toUser = (userId: string, m: ServerMessage) => sockets.get(userId)?.forEach((ws) => send(ws, m));
const toAll = (m: ServerMessage) => sockets.forEach((set) => set.forEach((ws) => send(ws, m)));

// ---- AI budget ---------------------------------------------------------------
//
// Every decision, chat line and trait guess can cost an AI call. A public demo
// must not let one visitor (or a script) burn the TypeSafe / Anthropic quota:
// per-shopper and global per-minute caps; over them we fall back to the rule
// engine / keyword reader, which cost nothing, so the store keeps working.
// (Per shopper, not per IP: behind Vite's proxy and Tailscale Funnel every
// request comes from 127.0.0.1.)

const hits = new Map<string, number[]>();
let aiFallbacks = 0; // shown on the stats page
function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) { hits.set(key, recent); return false; }
  recent.push(now);
  hits.set(key, recent);
  return true;
}
const AI_PER_SHOPPER_PER_MIN = Number(process.env.SHOP_AI_PER_SHOPPER_PER_MIN ?? 30);
const AI_GLOBAL_PER_MIN = Number(process.env.SHOP_AI_GLOBAL_PER_MIN ?? 200);
function aiAllowed(userId: string): boolean {
  // Check the shopper first so one busy shopper can't use up the global budget alone.
  const ok = allow(`ai:${userId}`, AI_PER_SHOPPER_PER_MIN, 60_000) && allow("ai:*", AI_GLOBAL_PER_MIN, 60_000);
  if (!ok) { aiFallbacks++; console.warn(`[ai] budget exceeded for ${userId}; using rules`); }
  return ok;
}

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

// ---- behaviour → personality (shared/infer.ts) ------------------------------
//
// After enough browsing, ask Jev (or the rule fallback) which traits the
// behaviour shows, and add confident guesses to the persona before deciding —
// so the store reshapes around who the shopper seems to be, not only what they
// clicked. Rate-limited: once per cooldown and every few new events.

const inferState = new Map<string, { at: number; events: number }>();
const TZ = process.env.SHOP_TZ ?? "Asia/Taipei";

async function maybeInfer(userId: string, trigger: string) {
  if (!BEHAVIOUR_TRIGGERS.has(trigger)) return;
  const user = getUser(userId);
  if (!user) return;
  const ev = profileEvents(userId, 200);
  const last = inferState.get(userId) ?? { at: 0, events: 0 };
  if (ev.length < MIN_EVENTS || Date.now() - last.at < INFER_COOLDOWN_MS || ev.length - last.events < INFER_EVERY_EVENTS) return;
  inferState.set(userId, { at: Date.now(), events: ev.length });

  const summary = behaviourSummary(ev, getCart(userId), listProducts(), localHour(TZ));
  let probs: Awaited<ReturnType<typeof inferTraitsWithTypeSafe>>;
  let by = "rules";
  try {
    if (typesafeEnabled() && aiAllowed(userId)) { probs = blend(await inferTraitsWithTypeSafe(summary), inferTraitsByRules(summary)); by = "typesafe+rules"; }
    else probs = inferTraitsByRules(summary);
  } catch (err) {
    console.warn("[infer] TypeSafe failed, using rules:", (err as Error).message);
    probs = inferTraitsByRules(summary);
  }
  const { prefs, change } = applyInferred(user.prefs, probs);
  if (!change.added.length && !change.dropped.length) return;
  setPrefs(userId, prefs);
  toUser(userId, { type: "user", user: { ...user, prefs } });
  console.log(`[infer] ${userId} → ${by} +${change.added.join(",") || "-"} −${change.dropped.join(",") || "-"}`);
}

async function run(userId: string, trigger: string): Promise<DecisionEnvelope | undefined> {
  const s = sched.get(userId) ?? { inFlight: false, lastMarketRun: 0 };
  sched.set(userId, s);
  if (!getUser(userId)) return;
  s.inFlight = true;
  toUser(userId, { type: "deciding", trigger });
  try {
    await maybeInfer(userId, trigger).catch((err) => console.warn("[infer]", (err as Error).message));
    const input = buildInput(userId, trigger);
    if (!input) return;
    const env = await decide(input, { llm: aiAllowed(userId) });
    latest.set(userId, env);
    saveDecision(userId, env.source, trigger, env.latencyMs, env.decision);
    toUser(userId, { type: "decision", envelope: env });
    console.log(`[decide] ${userId} ${trigger} → ${env.source} ${env.latencyMs}ms`);
    return env;
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

app.get("/api/meta", (_req, res) => { res.json({ claude: llmEnabled() }); });

// Stats page (web/stats.html). The demo URL is public, so this needs the key
// from SHOP_STATS_KEY; without one set, stats are off entirely.
const STATS_KEY = process.env.SHOP_STATS_KEY?.trim();
app.get("/api/stats", (req, res) => {
  const given = String(req.get("x-stats-key") ?? "");
  if (!STATS_KEY) { res.status(403).json({ error: "disabled" }); return; }
  const a = Buffer.from(given), b = Buffer.from(STATS_KEY);
  if (a.length !== b.length || !timingSafeEqual(a, b)) { res.status(401).json({ error: "bad_key" }); return; }
  const tabs = [...sockets.values()].reduce((n, set) => n + set.size, 0);
  res.json(buildStats({ shoppers: [...sockets.keys()].filter((id) => isVisitor(id) && id !== "u_new").length, tabs }, aiFallbacks));
});
app.get("/api/products", (_req, res) => { res.json(listProducts()); });
// Only the demo shoppers are listed. Visitors' ids are random and never
// listed, so nobody can pick someone else's "你" to act as them (there is no
// login in the demo; an id you don't know is the only protection).
app.get("/api/users", (_req, res) => { res.json(listUsers().filter((u) => !isVisitor(u.id))); });
app.get("/api/users/:id", (req, res) => {
  const u = getUser(req.params.id);
  if (!u) { res.status(404).end(); return; }
  res.json(u);
});

app.post("/api/users", (req, res) => {
  // Each new visitor is a DB row: cap how fast they can be made.
  if (!allow("create-user", 120, 60 * 60_000)) { res.status(429).end(); return; }
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
    vibe: oneOf(["auto", ...VIBES] as const, b.vibe) ?? "auto",
    budget: b.budget != null && Number.isFinite(budget) && budget > 0 ? Math.round(budget) : null,
    categories: someOf(SHOP_CATEGORIES, b.categories),
    need: String(b.need ?? "").slice(0, 200),
    persona,
  };
}

app.put("/api/users/:id/prefs", (req, res) => {
  const user = getUser(req.params.id);
  if (!user) { res.status(404).end(); return; }
  // Guesses the shopper removed become rejections (shared/infer.ts).
  const prefs = mergeManualPrefs(user.prefs, parsePrefs(req.body ?? {}));
  setPrefs(user.id, prefs);
  const updated = { ...user, prefs };
  // Other tabs of the same shopper see the new persona / prefs right away.
  toUser(user.id, { type: "user", user: updated });
  requestDecision(user.id, "prefs", 0);
  res.json(updated);
});

// Chat: read what the shopper said (Claude > Jev > keywords), write it into
// their prefs, re-decide right away (they asked, so it may rearrange the page),
// and answer with the top of the new store. `reply: null` = the frontend
// answers from copy.ts.
app.post("/api/users/:id/chat", async (req, res) => {
  const user = getUser(req.params.id);
  const text = String(req.body?.text ?? "").trim().slice(0, 500);
  if (!user || !text) { res.status(400).end(); return; }
  const history: ChatTurn[] = (Array.isArray(req.body?.history) ? req.body.history : [])
    .filter((t: ChatTurn) => (t?.role === "user" || t?.role === "assistant") && typeof t.text === "string")
    .slice(-6).map((t: ChatTurn) => ({ role: t.role, text: t.text.slice(0, 500) }));

  const products = listProducts();
  const names = (ids: string[]) => ids.map((id) => getProduct(id)?.name).filter((n): n is string => !!n);
  const ctx: ChatContext = {
    prefs: user.prefs,
    profile: buildProfile(user.id, products),
    recent: names(recentProductIds(user.id)),
    cart: names(getCart(user.id).map((l) => l.productId)),
    archetype: latest.get(user.id)?.decision.archetype ?? "editorial",
  };

  let understood: { update: ChatUpdate; reply: string | null } | undefined;
  let by: ChatResult["understoodBy"] = "rules";
  try {
    // Over budget → the keyword reader below (free, instant) instead of an AI call.
    if (!aiAllowed(user.id)) { /* keywords */ }
    else if (claudeEnabled()) { understood = await chatWithClaude(ctx, history, text); by = "claude"; }
    else if (typesafeEnabled()) { understood = { update: await understandWithTypeSafe(ctx, history, text), reply: null }; by = "typesafe"; }
  } catch (err) {
    console.warn("[chat] AI failed, using keywords:", (err as Error).message);
    by = "rules";
  }
  understood ??= { update: understandByKeywords(text), reply: null };

  const { prefs, changes } = applyChatUpdate(user.prefs, understood.update);
  if (changes.length) {
    setPrefs(user.id, prefs);
    toUser(user.id, { type: "user", user: { ...user, prefs } });
  }
  const env = (await run(user.id, "chat")) ?? latest.get(user.id);
  const d = env?.decision;
  const productIds = d ? [...new Set([...d.hero.productIds, ...d.sections.flatMap((s) => s.productIds)])].slice(0, 3) : [];
  const out: ChatResult = { reply: understood.reply, understoodBy: by, changes, productIds, archetype: d?.archetype };
  console.log(`[chat] ${user.id} "${text.slice(0, 30)}" → ${by}, ${changes.length} changes`);
  res.json(out);
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
    if (llmEnabled()) requestDecision(userId, "open", 0);
  }

  ws.on("close", () => {
    const set = sockets.get(userId);
    set?.delete(ws);
    if (set?.size === 0) sockets.delete(userId);
  });
});

server.listen(PORT, () => {
  console.log(`[shop] http://localhost:${PORT}  decision engine: ${typesafeEnabled() ? "TypeSafe" : claudeEnabled() ? "Claude" : "rules (set TYPESAFE_API_KEY or ANTHROPIC_API_KEY)"}`);
});
