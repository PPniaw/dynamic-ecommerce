// Numbers for the stats page: how many people are playing with the demo, and
// what stores they ended up with. Visitors only — the four demo shoppers are
// shared by everyone and would blur the counts.
import type { Decision } from "../shared/decision.ts";
import { isVisitor, nothingStated, type Persona } from "../shared/personas.ts";
import { statsRows } from "./db.ts";

const DAY = 24 * 60 * 60_000;
const TZ = process.env.SHOP_TZ ?? "Asia/Taipei";

// Midnight today in the shop's timezone, as a timestamp.
function todayStart(now = Date.now()): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" })
    .formatToParts(now);
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return now - ((n("hour") * 60 + n("minute")) * 60 + n("second")) * 1000 - (now % 1000);
}

const hourIn = (ts: number) => Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(ts));

const count = <T,>(xs: T[], key: (x: T) => string | undefined) => {
  const m = new Map<string, number>();
  for (const x of xs) { const k = key(x); if (k) m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
};

export interface Stats {
  at: number;
  online: { shoppers: number; tabs: number };
  visitors: { total: number; newToday: number; activeToday: number; active24h: number; introduced: number; chatted: number };
  chats: { total: number; today: number };
  orders: { total: number; today: number; revenueToday: number };
  aiFallbacks: number;
  stores: { label: string; value: number }[];      // "collage × y2k"
  mbti: { label: string; value: number }[];
  sources24h: { label: string; value: number }[];  // typesafe / rules / claude
  hourly: { hour: number; start: number; shoppers: number }[]; // last 24 hours
}

export function buildStats(online: { shoppers: number; tabs: number }, aiFallbacks: number, now = Date.now()): Stats {
  const today = todayStart(now);
  const rows = statsRows(now - DAY);
  const visitors = rows.users.filter((u) => isVisitor(u.id) && u.id !== "u_new");
  const vis = new Set(visitors.map((u) => u.id));
  const seen = rows.seen.filter((s) => vis.has(s.user_id));
  const persona = (json: string): Persona | undefined => { try { return JSON.parse(json).persona; } catch { return undefined; } };
  const personas = visitors.map((u) => persona(u.prefs)).filter((p): p is Persona => !!p);
  const recent = rows.recent.filter((r) => vis.has(r.user_id));

  const latest = rows.latest.filter((l) => vis.has(l.user_id)).map((l) => {
    try { const d = JSON.parse(l.body) as Decision; return `${d.archetype} × ${d.theme.vibe ?? "none"}`; } catch { return undefined; }
  });

  const hourly = Array.from({ length: 24 }, (_, i) => {
    const start = now - (24 - i) * 60 * 60_000;
    const who = new Set(recent.filter((r) => r.ts >= start && r.ts < start + 60 * 60_000).map((r) => r.user_id));
    return { hour: hourIn(start), start, shoppers: who.size };
  });

  const orders = rows.orders.filter((o) => vis.has(o.user_id));
  return {
    at: now,
    online,
    visitors: {
      total: visitors.length,
      newToday: seen.filter((s) => s.first >= today).length,
      activeToday: seen.filter((s) => s.last >= today).length,
      active24h: new Set(recent.map((r) => r.user_id)).size,
      introduced: personas.filter((p) => !nothingStated(p)).length,
      chatted: seen.filter((s) => s.chats > 0).length,
    },
    chats: { total: seen.reduce((a, s) => a + s.chats, 0), today: recent.filter((r) => r.trigger === "chat" && r.ts >= today).length },
    orders: {
      total: orders.length,
      today: orders.filter((o) => o.ts >= today).length,
      revenueToday: orders.filter((o) => o.ts >= today).reduce((a, o) => a + o.total, 0),
    },
    aiFallbacks,
    stores: count(latest, (x) => x),
    mbti: count(personas, (p) => p.mbti ?? undefined),
    sources24h: count(recent, (r) => r.source),
    hourly,
  };
}
