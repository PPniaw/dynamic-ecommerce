// One websocket per tab. Holds the live catalog, this shopper's current
// storefront decision, their cart, and a short activity feed.
import { useEffect, useRef, useState } from "react";
import type { ActivityItem, CartLine, DecisionEnvelope, Product, ServerMessage, User } from "../../shared/decision";

export interface Live {
  connected: boolean;
  user?: User;
  products: Map<string, Product>;
  // Product ids whose price/stock just changed — cards flash on these.
  changed: Map<string, number>;
  envelope?: DecisionEnvelope;
  deciding?: string;
  cart: CartLine[];
  activity: ActivityItem[];
}

export function useLive(userId: string | undefined): Live {
  const [s, setS] = useState<Live>({ connected: false, products: new Map(), changed: new Map(), cart: [], activity: [] });
  const retry = useRef(0);

  useEffect(() => {
    if (!userId) return;
    let ws: WebSocket;
    let closed = false;
    let timer: ReturnType<typeof setTimeout>;
    setS({ connected: false, products: new Map(), changed: new Map(), cart: [], activity: [] });

    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${location.host}/ws?userId=${encodeURIComponent(userId)}`);
      ws.onopen = () => { retry.current = 0; setS((p) => ({ ...p, connected: true })); };
      ws.onclose = () => {
        setS((p) => ({ ...p, connected: false }));
        if (!closed) timer = setTimeout(connect, Math.min(8000, 500 * 2 ** retry.current++));
      };
      ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data) as ServerMessage;
        setS((p) => {
          switch (m.type) {
            case "hello":
              return { ...p, user: m.user, products: new Map(m.products.map((x) => [x.id, x])) };
            case "products": {
              const products = new Map(p.products);
              const changed = new Map(p.changed);
              for (const x of m.products) { products.set(x.id, x); changed.set(x.id, Date.now()); }
              return { ...p, products, changed };
            }
            case "deciding":
              return { ...p, deciding: m.trigger };
            case "decision":
              return { ...p, envelope: m.envelope, deciding: undefined };
            case "cart":
              return { ...p, cart: m.lines };
            case "activity":
              return { ...p, activity: [m.item, ...p.activity].slice(0, 30) };
          }
        });
      };
    };
    connect();
    return () => { closed = true; clearTimeout(timer); ws?.close(); };
  }, [userId]);

  return s;
}
