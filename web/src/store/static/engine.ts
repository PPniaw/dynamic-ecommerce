// In-browser backend for the static preview (VITE_STATIC=1): the same rule
// engine, seed shoppers, catalog, market simulator and scheduling rules as
// server/, running in the tab. It answers the same API and pushes the same
// ServerMessages, so the store code can't tell the difference.
//
// Keep behaviour in step with server/index.ts — this is a mirror, not a fork:
// decisions come from server/decision/rules.ts itself, profiles from
// shared/profile.ts.
import { CATALOG, type Product } from "../../../../shared/catalog";
import type { ActivityItem, CartLine, DecisionEnvelope, EventType, ServerMessage, User, UserPrefs } from "../../../../shared/decision";
import { profileFrom, recentIdsFrom, type ProfileEvent } from "../../../../shared/profile";
import { applyInferred, behaviourSummary, BEHAVIOUR_TRIGGERS, INFER_COOLDOWN_MS, INFER_EVERY_EVENTS, inferTraitsByRules, localHour, mergeManualPrefs, MIN_EVENTS } from "../../../../shared/infer";
import { applyChatUpdate, chatPrompt, parseChatAnswer, understandByKeywords, type ChatResult, type ChatTurn } from "../../../../shared/chat";
import { decideWithRules } from "../../../../server/decision/rules";
import { SEED_USERS } from "../../../../server/seed";
import type { Order } from "../api";

type Handler = (m: ServerMessage) => void;

// ---- state -----------------------------------------------------------------

interface Row { p: Product; list: number }
const rows = new Map<string, Row>(CATALOG.map((c, i) => [c.id, {
  // A little sales history so "trending" means something on first load.
  p: { ...c, compareAt: undefined, sold: (i * 7) % 13 },
  list: c.compareAt ?? c.price,
}]));
const product = (r: Row): Product => ({ ...r.p, compareAt: r.p.price < r.list ? r.list : undefined });
const products = () => [...rows.values()].map(product);

const PREFS_KEY = "llm-shop:static-prefs";
const saved = (() => { try { return JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Record<string, UserPrefs>; } catch { return {}; } })();
const users = new Map<string, User>(SEED_USERS.map((u) => [u.id, { id: u.id, name: u.name, prefs: saved[u.id] ?? u.prefs }]));
const events = new Map<string, ProfileEvent[]>();
const carts = new Map<string, (CartLine)[]>();
const orders = new Map<string, Order[]>();
let nextOrder = 1;
const subs = new Map<string, Set<Handler>>();
const latest = new Map<string, DecisionEnvelope>();

const emit = (userId: string, m: ServerMessage) => subs.get(userId)?.forEach((h) => h(m));
const emitAll = (m: ServerMessage) => subs.forEach((_, id) => emit(id, m));
const log = (userId: string, type: EventType, productId: string | null) => {
  const list = events.get(userId) ?? [];
  list.unshift({ type, productId, ts: Date.now() });
  events.set(userId, list.slice(0, 200));
};

// ---- decisions (same debounce / coalescing as the server) -------------------

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const lastMarketRun = new Map<string, number>();

// Behaviour → traits, same gating as the server; rules only (no Jev key in a page).
const inferState = new Map<string, { at: number; events: number }>();
function maybeInfer(userId: string, trigger: string) {
  if (!BEHAVIOUR_TRIGGERS.has(trigger)) return;
  const ev = events.get(userId) ?? [];
  const last = inferState.get(userId) ?? { at: 0, events: 0 };
  if (ev.length < MIN_EVENTS || Date.now() - last.at < INFER_COOLDOWN_MS || ev.length - last.events < INFER_EVERY_EVENTS) return;
  inferState.set(userId, { at: Date.now(), events: ev.length });
  const summary = behaviourSummary(ev, cartOf(userId), products(), localHour());
  const { prefs, change } = applyInferred(users.get(userId)!.prefs, inferTraitsByRules(summary));
  if (change.added.length || change.dropped.length) savePrefs(userId, prefs);
}

function decideNow(userId: string, trigger: string): DecisionEnvelope | undefined {
  if (!users.has(userId)) return;
  maybeInfer(userId, trigger);
  const user = users.get(userId)!;
  emit(userId, { type: "deciding", trigger });
  const t0 = performance.now();
  const ps = products();
  const ev = events.get(userId) ?? [];
  const cart = carts.get(userId) ?? [];
  const decision = decideWithRules({
    user, products: ps, trigger,
    profile: profileFrom(ev, cart, ps),
    listPrices: new Map([...rows].map(([id, r]) => [id, r.list])),
    recentIds: recentIdsFrom(ev),
    cartIds: cart.map((l) => l.productId),
  });
  const env: DecisionEnvelope = { decision, source: "rules", latencyMs: Math.round(performance.now() - t0), at: Date.now(), trigger };
  latest.set(userId, env);
  // A short beat so "正在重新安排" is visible, as it is with a real server.
  setTimeout(() => emit(userId, { type: "decision", envelope: env }), 350);
  return env;
}

// ---- chat: Claude through the artifact's `sample` capability -----------------
//
// On claude.ai the published page can ask Claude on the *viewer's own*
// subscription (no API key; the first call asks them to allow it). Anywhere
// else `use("sample")` is null or missing and the keyword reader takes over.

interface Sample { json: (input: string, opts?: { modelTier?: "quick" | "default" | "complex"; cache?: boolean }) => Promise<unknown> }
let sampleP: Promise<Sample | null> | undefined;
const getSample = () => (sampleP ??= (async () => {
  const c = (globalThis as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
  return c?.use ? ((await c.use("sample")) as Sample | null) : null;
})().catch(() => null));

function savePrefs(id: string, prefs: UserPrefs) {
  const u = users.get(id)!;
  const next = { ...u, prefs };
  users.set(id, next);
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(Object.fromEntries([...users].map(([k, v]) => [k, v.prefs])))); } catch { /* ignore */ }
  emit(id, { type: "user", user: next });
  return next;
}

function request(userId: string, trigger: string, delay = 900) {
  clearTimeout(timers.get(userId));
  timers.set(userId, setTimeout(() => decideNow(userId, trigger), delay));
}

// ---- market simulator --------------------------------------------------------

const PRICE_STEPS = [0.7, 0.8, 0.85, 0.9, 1, 1, 1.1];
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

let started = false;
const startMarket = () => { if (!started) { started = true; setInterval(marketTick, 2500); } };

function marketTick() {
  if (!subs.size) return;
  const all = [...rows.values()];
  const r = Math.random();
  let item: ActivityItem | undefined;
  let row: Row | undefined;
  if (r < 0.6) {
    row = pick(all.filter((x) => x.p.stock > 0));
    if (!row) return;
    const qty = Math.min(row.p.stock, 1 + Math.floor(Math.random() * 3));
    row.p = { ...row.p, stock: row.p.stock - qty, sold: row.p.sold + qty };
    item = { kind: row.p.stock === 0 ? "sold_out" : "sold", productId: row.p.id, qty, at: Date.now() };
  } else if (r < 0.7) {
    row = pick(all.filter((x) => x.p.stock < 5)) ?? pick(all);
    row.p = { ...row.p, stock: row.p.stock + 15 };
    item = { kind: "restock", productId: row.p.id, qty: 15, at: Date.now() };
  } else {
    row = pick(all);
    const to = Math.round((row.list * pick(PRICE_STEPS)) / 10) * 10;
    if (to === row.p.price) return;
    item = { kind: to < row.p.price ? "price_drop" : "price_up", productId: row.p.id, from: row.p.price, to, at: Date.now() };
    row.p = { ...row.p, price: to };
  }
  emitAll({ type: "products", products: [product(row)] });
  emitAll({ type: "activity", item });
  const material = item.kind === "sold_out" || item.kind === "restock" || (item.kind === "price_drop" && item.to! <= row.list * 0.9);
  if (!material) return;
  for (const userId of subs.keys()) {
    const env = latest.get(userId);
    const shown = env && (env.decision.hero.productIds.includes(item.productId) || env.decision.sections.slice(0, 2).some((s) => s.productIds.includes(item.productId)));
    if ((shown || item.kind === "price_drop") && Date.now() - (lastMarketRun.get(userId) ?? 0) > 20_000) {
      lastMarketRun.set(userId, Date.now());
      request(userId, `market:${item.kind}`);
    }
  }
}

// ---- API (same shapes as server/index.ts) -----------------------------------

const fail = (status: number, body: unknown) => Object.assign(new Error(`HTTP ${status}`), { status, body });
const cartOf = (id: string) => carts.get(id) ?? [];

export const api = {
  meta: async () => ({ claude: false }),
  users: async () => [...users.values()],
  setPrefs: async (id: string, prefs: UserPrefs) => {
    const u = users.get(id);
    if (!u) throw fail(404, null);
    const next = savePrefs(id, mergeManualPrefs(u.prefs, prefs));
    request(id, "prefs", 0);
    return next;
  },
  chat: async (id: string, text: string, history: ChatTurn[]): Promise<ChatResult> => {
    const user = users.get(id);
    if (!user) throw fail(404, null);
    const ev = events.get(id) ?? [];
    const cart = cartOf(id);
    const ps = products();
    const name = (pid: string) => rows.get(pid)?.p.name;
    const ctx = {
      prefs: user.prefs,
      profile: profileFrom(ev, cart, ps),
      recent: recentIdsFrom(ev).map(name).filter((n): n is string => !!n),
      cart: cart.map((l) => name(l.productId)).filter((n): n is string => !!n),
      archetype: latest.get(id)?.decision.archetype ?? "editorial",
    };
    let understood: ReturnType<typeof parseChatAnswer> | undefined;
    let by: ChatResult["understoodBy"] = "rules";
    const sample = await getSample();
    if (sample) {
      try {
        understood = parseChatAnswer(await sample.json(chatPrompt(ctx, history, text), { modelTier: "quick", cache: false }));
        by = "claude";
      } catch { /* declined, rate limited, bad JSON → keywords */ }
    }
    understood ??= { update: understandByKeywords(text), reply: null };
    const { prefs, changes } = applyChatUpdate(user.prefs, understood.update);
    if (changes.length) savePrefs(id, prefs);
    clearTimeout(timers.get(id));
    const d = decideNow(id, "chat")?.decision;
    const productIds = d ? [...new Set([...d.hero.productIds, ...d.sections.flatMap((s) => s.productIds)])].slice(0, 3) : [];
    return { reply: understood.reply, understoodBy: by, changes, productIds };
  },
  profile: async (id: string) => profileFrom(events.get(id) ?? [], cartOf(id), products()),
  event: async (userId: string, type: "view" | "favorite" | "search", productId?: string) => {
    log(userId, type, productId ?? null);
    request(userId, type);
  },
  setQty: async (id: string, productId: string, qty: number) => {
    const row = rows.get(productId);
    if (!row) throw fail(404, null);
    const lines = cartOf(id);
    const before = lines.find((l) => l.productId === productId)?.qty ?? 0;
    const next = qty <= 0 ? lines.filter((l) => l.productId !== productId)
      : before ? lines.map((l) => (l.productId === productId ? { ...l, qty } : l))
      : [...lines, { productId, qty, priceAtAdd: row.p.price }];
    carts.set(id, next);
    const type = qty > before ? "add_to_cart" : "remove_from_cart";
    log(id, type, productId);
    emit(id, { type: "cart", lines: next });
    request(id, type);
    return next;
  },
  checkout: async (id: string) => {
    const lines = cartOf(id);
    if (!lines.length) throw fail(409, { error: "empty" });
    for (const l of lines) if (rows.get(l.productId)!.p.stock < l.qty) throw fail(409, { error: "out_of_stock", productId: l.productId });
    let total = 0;
    const items = lines.map((l) => {
      const row = rows.get(l.productId)!;
      total += row.p.price * l.qty;
      row.p = { ...row.p, stock: row.p.stock - l.qty, sold: row.p.sold + l.qty };
      log(id, "purchase", l.productId);
      return { productId: l.productId, qty: l.qty, price: row.p.price };
    });
    const order: Order = { id: nextOrder++, total, ts: Date.now(), items };
    orders.set(id, [order, ...(orders.get(id) ?? [])]);
    carts.set(id, []);
    emitAll({ type: "products", products: lines.map((l) => product(rows.get(l.productId)!)) });
    emit(id, { type: "cart", lines: [] });
    request(id, "purchase");
    return { orderId: order.id, total };
  },
  orders: async (id: string) => orders.get(id) ?? [],
};

export function connect(userId: string, h: Handler): () => void {
  const user = users.get(userId);
  if (!user) return () => {};
  startMarket();
  if (!subs.has(userId)) subs.set(userId, new Set());
  subs.get(userId)!.add(h);
  // Same opening sequence as the server's websocket: hello, cart, decision.
  queueMicrotask(() => {
    h({ type: "hello", products: products(), user });
    h({ type: "cart", lines: cartOf(userId) });
    const cached = latest.get(userId);
    if (cached) h({ type: "decision", envelope: cached });
    else decideNow(userId, "open");
  });
  return () => { subs.get(userId)?.delete(h); if (!subs.get(userId)?.size) subs.delete(userId); };
}
