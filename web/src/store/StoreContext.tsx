// Live store state: one websocket per tab carrying the catalog (prices and
// stock move every few seconds), this shopper's decision, their cart and the
// activity feed.
//
// Decision timing is a UX rule (design-spec §6, §10): a re-decision caused by
// browsing does NOT rearrange the page you're reading — it waits and applies
// on your next navigation (or when you tap "套用"). Only changes you asked for
// (switching shopper, editing your profile) apply at once, with a view
// transition so the store visibly morphs instead of snapping.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import type { Product } from "../../../shared/catalog";
import type { ActivityItem, CartLine, DecisionEnvelope, ServerMessage, User, UserPrefs } from "../../../shared/decision";
import { api, openChannel } from "./backend";

const USER_KEY = "llm-shop:user";
const readUser = () => { try { return localStorage.getItem(USER_KEY) ?? undefined; } catch { return undefined; } };
const writeUser = (id: string) => { try { localStorage.setItem(USER_KEY, id); } catch { /* private mode */ } };

// Triggers the shopper asked for — these may rearrange the current page.
const IMMEDIATE = new Set(["open", "prefs"]);

export function withTransition(update: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (doc.startViewTransition && !reduce) doc.startViewTransition(() => flushSync(update));
  else update();
}

interface Store {
  connected: boolean;
  claude: boolean;
  users: User[];
  user?: User;
  products: Map<string, Product>;
  changed: Map<string, number>;
  envelope?: DecisionEnvelope;
  pending?: DecisionEnvelope;
  deciding?: string;
  cart: CartLine[];
  cartOpen: boolean;
  activity: ActivityItem[];
  switchUser: (id: string) => void;
  savePrefs: (prefs: UserPrefs) => Promise<void>;
  applyPending: () => void;
  view: (productId: string) => void;
  favorite: (productId: string) => void;
  setQty: (productId: string, qty: number) => Promise<void>;
  add: (productId: string) => Promise<void>;
  checkout: () => Promise<{ orderId: number; total: number }>;
  setCartOpen: (open: boolean) => void;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState<string | undefined>(readUser);
  const [claude, setClaude] = useState(false);
  const [connected, setConnected] = useState(false);
  const [user, setUser] = useState<User>();
  const [products, setProducts] = useState<Map<string, Product>>(new Map());
  const [changed, setChanged] = useState<Map<string, number>>(new Map());
  const [envelope, setEnvelope] = useState<DecisionEnvelope>();
  const [pending, setPending] = useState<DecisionEnvelope>();
  const [deciding, setDeciding] = useState<string>();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  // Set while a shopper switch is in flight, so its first decision applies at once.
  const switching = useRef(true);

  useEffect(() => {
    api.meta().then((m) => setClaude(m.claude)).catch(() => {});
    api.users().then((us) => {
      setUsers(us);
      setUserId((cur) => (cur && us.some((u) => u.id === cur) ? cur : us.find((u) => u.id === "u_new")?.id ?? us[0]?.id));
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    writeUser(userId);
    return openChannel(userId, {
      onOpen: () => setConnected(true),
      onClose: () => setConnected(false),
      onMessage: (m: ServerMessage) => {
        switch (m.type) {
          case "hello":
            setUser(m.user);
            setProducts(new Map(m.products.map((p) => [p.id, p])));
            break;
          case "user":
            setUser(m.user);
            setUsers((us) => us.map((u) => (u.id === m.user.id ? m.user : u)));
            break;
          case "products":
            setProducts((prev) => { const n = new Map(prev); for (const p of m.products) n.set(p.id, p); return n; });
            setChanged((prev) => { const n = new Map(prev); for (const p of m.products) n.set(p.id, Date.now()); return n; });
            break;
          case "deciding":
            setDeciding(m.trigger);
            break;
          case "decision": {
            setDeciding(undefined);
            const env = m.envelope;
            if (switching.current || IMMEDIATE.has(env.trigger)) {
              switching.current = false;
              setPending(undefined);
              withTransition(() => setEnvelope(env));
            } else {
              setPending(env);
            }
            break;
          }
          case "cart":
            setCart(m.lines);
            break;
          case "activity":
            setActivity((a) => [m.item, ...a].slice(0, 30));
            break;
        }
      },
    });
  }, [userId]);

  // Read the waiting decision from a ref: applying it from inside a setState
  // updater would update state mid-render when view transitions are missing.
  const pendingRef = useRef<DecisionEnvelope>(undefined);
  pendingRef.current = pending;
  const applyPending = useCallback(() => {
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = undefined;
    setPending(undefined);
    withTransition(() => setEnvelope(p));
  }, []);

  const store = useMemo<Store>(() => ({
    connected, claude, users, user, products, changed, envelope, pending, deciding, cart, cartOpen, activity,
    switchUser: (id) => { if (id === userId) return; switching.current = true; setPending(undefined); setUserId(id); },
    savePrefs: async (prefs) => {
      if (!userId) return;
      const u = await api.setPrefs(userId, prefs);
      setUser(u);
      setUsers((us) => us.map((x) => (x.id === u.id ? u : x)));
    },
    applyPending,
    view: (pid) => { if (userId) void api.event(userId, "view", pid); },
    favorite: (pid) => { if (userId) void api.event(userId, "favorite", pid); },
    setQty: async (pid, qty) => { if (userId) setCart(await api.setQty(userId, pid, qty)); },
    add: async (pid) => {
      if (!userId) return;
      const qty = (cart.find((l) => l.productId === pid)?.qty ?? 0) + 1;
      setCart(await api.setQty(userId, pid, qty));
      setCartOpen(true); // feedback for *your* add only; websocket cart updates never open it
    },
    checkout: async () => {
      if (!userId) throw new Error("no user");
      return api.checkout(userId);
    },
    setCartOpen,
  }), [connected, claude, users, user, products, changed, envelope, pending, deciding, cart, cartOpen, activity, userId, applyPending]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
