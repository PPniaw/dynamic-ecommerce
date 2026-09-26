// Demo stats: who is playing, and what stores they ended up with.
// Behind SHOP_STATS_KEY (the demo URL is public). Refreshes every 10 seconds.
//
// Forms (dataviz skill): one hero number (online now), stat tiles, then
// single-series horizontal bars (no legend: the title names the series) and a
// 24-hour column chart with per-column hover. Marks in the accent, text in
// text tokens; every value is also in the bars' labels or the hourly table.
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Archetype, Vibe } from "../../../shared/decision";
import type { Stats } from "../../../server/stats";
import { DEFAULT_THEME, ThemeScope } from "../ds/theme/ThemeScope";
import { cn } from "../ds/ui/cn";
import { ARCHETYPE_LABEL, SOURCE_SHORT, VIBE_LABEL } from "../store/copy";

const KEY = "llm-shop:stats-key";
const fmt = new Intl.NumberFormat("zh-TW");

type Load = { state: "need-key" } | { state: "loading" } | { state: "ok"; stats: Stats } | { state: "error"; msg: string };

export function StatsPage() {
  const [key, setKey] = useState<string>();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try { setKey(localStorage.getItem(KEY) ?? undefined); } catch { /* private mode */ }
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    setDark(!!mq?.matches);
    const on = (e: MediaQueryListEvent) => setDark(e.matches);
    mq?.addEventListener?.("change", on);
    return () => mq?.removeEventListener?.("change", on);
  }, []);

  const fetchStats = useCallback(async (k: string) => {
    const res = await fetch("/api/stats", { headers: { "x-stats-key": k } });
    if (res.status === 401) { try { localStorage.removeItem(KEY); } catch { /* */ } setKey(undefined); setLoad({ state: "error", msg: "密碼不對,請重新輸入。" }); return; }
    if (res.status === 403) { setLoad({ state: "error", msg: "統計頁未啟用:請在 .env 設定 SHOP_STATS_KEY 後重新啟動 server。" }); return; }
    if (!res.ok) { setLoad({ state: "error", msg: `讀取失敗(HTTP ${res.status})` }); return; }
    setLoad({ state: "ok", stats: await res.json() });
  }, []);

  useEffect(() => {
    if (!key) { setLoad((l) => (l.state === "error" ? l : { state: "need-key" })); return; }
    void fetchStats(key).catch(() => setLoad({ state: "error", msg: "連不到 server。" }));
    const t = setInterval(() => void fetchStats(key).catch(() => {}), 10_000);
    return () => clearInterval(t);
  }, [key, fetchStats]);

  const theme = useMemo(() => ({ ...DEFAULT_THEME, palette: "ink" as const, fonts: "modern" as const, radius: "soft" as const, scheme: dark ? "dark" as const : "light" as const }), [dark]);

  return (
    <ThemeScope theme={theme} className="min-h-screen">
      <main className="page flex flex-col gap-10 py-10">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="eyebrow text-fg-muted">日常所 · Demo</p>
            <h1 className="heading type-h1">統計</h1>
          </div>
          {load.state === "ok" && <p className="txt-small text-fg-muted">更新於 {new Date(load.stats.at).toLocaleTimeString("zh-TW")} · 每 10 秒更新</p>}
        </header>

        {(load.state === "need-key" || (load.state === "error" && !key)) && (
          <KeyForm onSubmit={(k) => { try { localStorage.setItem(KEY, k); } catch { /* */ } setLoad({ state: "loading" }); setKey(k); }}
            error={load.state === "error" ? load.msg : undefined} />
        )}
        {load.state === "error" && key && <p className="txt-medium text-danger">{load.msg}</p>}
        {load.state === "loading" && <p className="txt-medium text-fg-muted">讀取中…</p>}
        {load.state === "ok" && <Dashboard s={load.stats} />}
      </main>
    </ThemeScope>
  );
}

function KeyForm({ onSubmit, error }: { onSubmit: (k: string) => void; error?: string }) {
  const [v, setV] = useState("");
  return (
    <form className="flex max-w-md flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (v.trim()) onSubmit(v.trim()); }}>
      <label className="txt-medium" htmlFor="k">輸入統計密碼(`.env` 的 SHOP_STATS_KEY)</label>
      <div className="flex gap-2">
        <input id="k" type="password" value={v} onChange={(e) => setV(e.target.value)} autoFocus
          className="min-w-0 grow rounded-control bg-component px-3 py-2 txt-medium outline-none focus:ring-2 focus:ring-accent" />
        <button type="submit" className="cursor-pointer rounded-control bg-primary px-4 py-2 txt-medium font-semibold text-on-primary">查看</button>
      </div>
      {error && <p className="txt-small text-danger">{error}</p>}
    </form>
  );
}

function Dashboard({ s }: { s: Stats }) {
  const storeLabel = (l: string) => {
    const [a, v] = l.split(" × ") as [Archetype, Vibe];
    const name = `${ARCHETYPE_LABEL[a]?.name ?? a}店`;
    return v && v !== "none" ? `${name} × ${VIBE_LABEL[v]?.name ?? v}` : name;
  };
  return (
    <>
      <section className="grid gap-6 md:grid-cols-[auto_1fr] md:items-end">
        <div>
          <p className="txt-medium text-fg-subtle">現在在線的訪客</p>
          <p className="font-sans text-[56px] leading-none font-semibold tabular-nums">{fmt.format(s.online.shoppers)}</p>
          <p className="mt-1 txt-small text-fg-muted">開著的分頁 {fmt.format(s.online.tabs)}(含切到示範顧客的)</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Tile label="訪客總數" value={s.visitors.total} note="每個瀏覽器算一位" />
          <Tile label="今天新訪客" value={s.visitors.newToday} />
          <Tile label="今天有互動" value={s.visitors.activeToday} />
          <Tile label="介紹過自己" value={s.visitors.introduced} note={pct(s.visitors.introduced, s.visitors.total)} />
          <Tile label="聊過天" value={s.visitors.chatted} note={`共 ${fmt.format(s.chats.total)} 則,今天 ${fmt.format(s.chats.today)}`} />
          <Tile label="今天結帳" value={s.orders.today} note={`NT$${fmt.format(s.orders.revenueToday)}(模擬)`} />
        </div>
      </section>

      <Card title="過去 24 小時,每小時有互動的訪客">
        <Hourly data={s.hourly} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="大家最後變成的店" sub="每位訪客目前的店型 × 風格">
          <Bars data={s.stores.map((d) => ({ ...d, label: storeLabel(d.label) }))} empty="還沒有訪客" />
        </Card>
        <Card title="訪客的 MBTI" sub="只算有填的">
          <Bars data={s.mbti} empty="還沒有人填 MBTI" />
        </Card>
        <Card title="過去 24 小時,誰決定了版面" sub={s.aiFallbacks ? `超過 AI 額度改用規則:${fmt.format(s.aiFallbacks)} 次(server 啟動後)` : "沒有超過 AI 額度"}>
          <Bars data={s.sources24h.map((d) => ({ ...d, label: SOURCE_SHORT[d.label as keyof typeof SOURCE_SHORT] ?? d.label }))} empty="過去 24 小時沒有決策" />
        </Card>
      </div>
    </>
  );
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}% 的訪客` : undefined);

function Tile({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="rounded-card bg-subtle p-4">
      <p className="txt-small text-fg-subtle">{label}</p>
      <p className="mt-1 text-[28px] leading-tight font-semibold tabular-nums">{fmt.format(value)}</p>
      {note && <p className="mt-0.5 txt-xsmall text-fg-muted">{note}</p>}
    </div>
  );
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-card p-5 ring-1 ring-line">
      <div>
        <h2 className="txt-large font-semibold">{title}</h2>
        {sub && <p className="txt-small text-fg-muted">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

// Horizontal bars: one series, sorted, value at the tip in text colour.
function Bars({ data, empty }: { data: { label: string; value: number }[]; empty: string }) {
  if (!data.length) return <p className="txt-small text-fg-muted">{empty}</p>;
  const max = Math.max(...data.map((d) => d.value));
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <ul className="flex flex-col gap-2.5">
      {data.slice(0, 10).map((d) => (
        <li key={d.label} className="grid grid-cols-[minmax(7rem,11rem)_1fr] items-center gap-3" title={`${d.label}:${d.value}(${Math.round((d.value / total) * 100)}%)`}>
          <span className="truncate txt-small">{d.label}</span>
          <span className="flex items-center gap-2">
            <span className="h-3 rounded-r-[4px] bg-accent" style={{ width: `${Math.max(2, (d.value / max) * 85)}%` }} />
            <span className="txt-small tabular-nums text-fg-subtle">{fmt.format(d.value)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

// 24 columns, one per hour; hover (or focus) shows the exact number.
function Hourly({ data }: { data: Stats["hourly"] }) {
  const [hover, setHover] = useState<number>();
  const max = Math.max(1, ...data.map((d) => d.shoppers));
  const label = (d: Stats["hourly"][number]) => `${String(d.hour).padStart(2, "0")}:00–${String((d.hour + 1) % 24).padStart(2, "0")}:00 · ${d.shoppers} 位`;
  return (
    <div>
      <div className="relative">
        <p className="absolute -top-1 left-0 txt-xsmall text-fg-muted tabular-nums">{max}</p>
        <div className="flex h-40 items-end gap-[2px] border-b border-line pt-5" onMouseLeave={() => setHover(undefined)}>
          {data.map((d, i) => (
            <button key={d.start} type="button" aria-label={label(d)}
              onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(undefined)}
              className="group relative flex h-full flex-1 cursor-default items-end justify-center">
              <span className={cn("w-full max-w-6 rounded-t-[4px] bg-accent transition-opacity", hover !== undefined && hover !== i && "opacity-40")}
                style={{ height: `${d.shoppers ? Math.max(3, (d.shoppers / max) * 100) : 0}%` }} />
            </button>
          ))}
        </div>
        {hover !== undefined && (
          <p className="pointer-events-none absolute -top-2 right-0 rounded-control bg-primary px-2 py-1 txt-xsmall text-on-primary tabular-nums">{label(data[hover])}</p>
        )}
      </div>
      <div className="mt-1 flex justify-between txt-xsmall text-fg-muted tabular-nums">
        {data.filter((_, i) => i % 6 === 0).map((d) => <span key={d.start}>{String(d.hour).padStart(2, "0")}:00</span>)}
        <span>現在</span>
      </div>
      <details className="mt-3 txt-small">
        <summary className="cursor-pointer text-fg-muted underline">看表格</summary>
        <table className="mt-2 w-full max-w-sm txt-small tabular-nums">
          <tbody>{data.map((d) => <tr key={d.start} className="border-b border-line"><td className="py-1">{label(d).split(" · ")[0]}</td><td className="text-right">{d.shoppers}</td></tr>)}</tbody>
        </table>
      </details>
    </div>
  );
}
