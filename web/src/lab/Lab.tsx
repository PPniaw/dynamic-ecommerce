// Design lab: every component in every variant, under every theme option the
// LLM can choose. This page is the design sign-off gate — if a combination
// looks wrong here, it doesn't ship to the store.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CATALOG, SHOP_CATEGORY_LABEL, type CatalogProduct } from "../../../shared/catalog";
import { contrast } from "../ds/theme/color";
import { deriveVars, type Surface as SurfaceName } from "../ds/theme/derive";
import { PALETTES, type PaletteName } from "../ds/theme/palettes";
import { DEFAULT_THEME, Surface, ThemeScope, type ThemeOptions } from "../ds/theme/ThemeScope";
import { Badge, type BadgeTone } from "../ds/ui/Badge";
import { Button } from "../ds/ui/Button";
import { cn } from "../ds/ui/cn";
import { Price } from "../ds/ui/Price";
import { DEFAULT_CARD, ProductCard, ProductCardSkeleton, type CardOptions, type Highlight } from "../ds/ui/ProductCard";
import type { ImageStatus } from "../ds/ui/ProductImage";
import { Stock } from "../ds/ui/Stock";
import { Segmented, Toggle } from "./Controls";

const KEY = "llm-shop:lab";
// The published preview can't load external images (its CSP blocks them), so
// every card shows the typographic fallback there. Say so instead of letting it
// look like a bug.
const PREVIEW = import.meta.env.VITE_PREVIEW === "1";
const load = (): { theme: ThemeOptions; card: CardOptions } => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (v) return { theme: { ...DEFAULT_THEME, ...v.theme }, card: { ...DEFAULT_CARD, ...v.card } };
  } catch { /* storage unavailable */ }
  return { theme: DEFAULT_THEME, card: DEFAULT_CARD };
};

// Same shape of change the real market simulator makes, faster, so price
// flashes and stock transitions can be judged here.
function useLiveMarket(on: boolean) {
  const [products, setProducts] = useState<CatalogProduct[]>(CATALOG);
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => {
      setProducts((ps) => {
        const i = Math.floor(Math.random() * ps.length);
        const p = ps[i];
        const base = CATALOG[i];
        const next = { ...p };
        const r = Math.random();
        if (r < 0.45) next.stock = Math.max(0, p.stock - 1 - Math.floor(Math.random() * 2));
        else if (r < 0.55) next.stock = p.stock + 8;
        else {
          const f = [0.8, 0.85, 0.9, 1, 1.05][Math.floor(Math.random() * 5)];
          next.price = Math.round((base.compareAt ?? base.price) * f / 10) * 10;
          next.compareAt = next.price < (base.compareAt ?? base.price) ? base.compareAt ?? base.price : undefined;
        }
        return ps.map((x, j) => (j === i ? next : x));
      });
    }, 1200);
    return () => clearInterval(t);
  }, [on]);
  return products;
}

const NAV = [
  ["color", "色彩"], ["type", "字體"], ["buttons", "按鈕"], ["badges", "徽章"], ["price", "價格與庫存"],
  ["cards", "商品卡"], ["axes", "卡片選項對照"], ["surfaces", "區塊底色"], ["skeleton", "骨架屏"], ["images", "圖片"],
] as const;

export function Lab() {
  const [{ theme, card }, setState] = useState(load);
  const [live, setLive] = useState(false);
  // On phones the controls would fill the first screen; keep them folded.
  const [controlsOpen, setControlsOpen] = useState(false);
  const [added, setAdded] = useState(0);
  const products = useLiveMarket(live);
  const imageStatus = useRef(new Map<string, ImageStatus>());
  const [, bump] = useState(0);

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify({ theme, card })); } catch { /* ignore */ } }, [theme, card]);
  const setTheme = <K extends keyof ThemeOptions>(k: K, v: ThemeOptions[K]) => setState((s) => ({ ...s, theme: { ...s.theme, [k]: v } }));
  const setCard = <K extends keyof CardOptions>(k: K, v: CardOptions[K]) => setState((s) => ({ ...s, card: { ...s.card, [k]: v } }));
  const quickAdd = async () => { await new Promise((r) => setTimeout(r, 500)); setAdded((n) => n + 1); };
  const track = (id: string) => (s: ImageStatus) => {
    if (s === "loading") return;
    imageStatus.current.set(id, s);
    bump((n) => n + 1);
  };

  return (
    <ThemeScope theme={theme} className="min-h-screen">
      <div className="flex min-h-screen flex-col lg:flex-row">
        {/* ---- controls ---- */}
        <aside className="border-b border-line bg-subtle lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0">
          <div className="flex flex-col gap-5 p-5">
            <div>
              <p className="eyebrow text-fg-muted">llm-shop</p>
              <h1 className="heading type-h3 mt-1">設計實驗室</h1>
              <p className="mt-1 txt-small text-fg-muted">LLM 能選的每一個選項都在這裡。這裡看起來不對,就不進商店。</p>
              {PREVIEW && (
                <p className="mt-3 rounded-card bg-component p-3 txt-xsmall text-fg-subtle">
                  預覽版:這個網頁不能載入外部圖片,所以商品卡都是文字底圖。真的商品照片要在本機跑 <code>npm run dev:web</code> 才看得到。
                </p>
              )}
              <Button variant="secondary" size="sm" className="mt-3 lg:hidden" aria-expanded={controlsOpen} onClick={() => setControlsOpen((o) => !o)}>
                {controlsOpen ? "收起選項" : "調整選項"}
              </Button>
            </div>
            <div className={cn("flex-col gap-5 lg:flex", controlsOpen ? "flex" : "hidden")}>
            <Segmented label="配色 palette" value={theme.palette} onChange={(v) => setTheme("palette", v)}
              options={(Object.keys(PALETTES) as PaletteName[]).map((k) => ({ value: k, label: PALETTES[k].label.split(" · ")[0] }))} />
            <Segmented label="明暗 scheme" value={theme.scheme} onChange={(v) => setTheme("scheme", v)} options={[{ value: "light", label: "亮" }, { value: "dark", label: "暗" }]} />
            <Segmented label="字體 fonts" value={theme.fonts} onChange={(v) => setTheme("fonts", v)}
              options={[{ value: "modern", label: "現代" }, { value: "editorial", label: "雜誌" }, { value: "friendly", label: "圓體" }, { value: "literary", label: "文楷" }]} />
            <Segmented label="字級 typeScale" value={theme.typeScale} onChange={(v) => setTheme("typeScale", v)} options={["compact", "normal", "display"] as const} />
            <Segmented label="標題大小寫 headingCase" value={theme.headingCase} onChange={(v) => setTheme("headingCase", v)} options={["none", "uppercase"] as const} />
            <Segmented label="圓角 radius" value={theme.radius} onChange={(v) => setTheme("radius", v)} options={["sharp", "soft", "round", "pill"] as const} />
            <Segmented label="密度 density" value={theme.density} onChange={(v) => setTheme("density", v)} options={["tight", "normal", "airy"] as const} />
            <Segmented label="hover 效果" value={theme.hoverEffect} onChange={(v) => setTheme("hoverEffect", v)} options={["none", "lift", "scale", "zoom"] as const} />
            <Segmented label="陰影 elevation" value={theme.elevation} onChange={(v) => setTheme("elevation", v)} options={["flat", "soft"] as const} />
            <hr className="border-line" />
            <Segmented label="卡片 圖片比例" value={card.imageRatio} onChange={(v) => setCard("imageRatio", v)} options={["portrait", "square", "landscape"] as const} />
            <Segmented label="卡片 hover" value={card.hover} onChange={(v) => setCard("hover", v)} options={["none", "second_image", "zoom"] as const} />
            <Segmented label="卡片 資訊排列" value={card.info} onChange={(v) => setCard("info", v)} options={["stacked", "row", "overlay"] as const} />
            <Segmented label="卡片 外框" value={card.frame} onChange={(v) => setCard("frame", v)} options={["bare", "card"] as const} />
            <Segmented label="徽章位置" value={card.badgePosition} onChange={(v) => setCard("badgePosition", v)} options={["top-left", "top-right", "bottom-left"] as const} />
            <Toggle label="快速加入" value={card.quickAdd} onChange={(v) => setCard("quickAdd", v)} />
            <hr className="border-line" />
            <Toggle label="模擬即時市場(價格 / 庫存跳動)" value={live} onChange={setLive} />
            <Button variant="ghost" size="sm" onClick={() => setState({ theme: DEFAULT_THEME, card: DEFAULT_CARD })}>重設</Button>
            </div>
          </div>
        </aside>

        {/* ---- content ---- */}
        <main className="min-w-0 flex-1">
          <nav className="sticky top-0 z-20 border-b border-line bg-base/85 backdrop-blur-md">
            <div className="flex gap-4 overflow-x-auto px-6 py-3 txt-small text-fg-subtle">
              {NAV.map(([id, label]) => <a key={id} href={`#${id}`} className="whitespace-nowrap hover:text-fg">{label}</a>)}
              <span className="ml-auto whitespace-nowrap text-fg-muted">快速加入 {added} 次</span>
            </div>
          </nav>

          <div className="flex flex-col gap-(--section-gap) px-6 py-10">
            <Block id="color" title="色彩" note="LLM 只選 palette 和每個區塊的底色(surface),所有角色色與對比由程式計算。數字是文字對背景的對比值,WCAG AA 需要 ≥ 4.5。">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {(["page", "subtle", "inverse", "accent"] as SurfaceName[]).map((s) => <SurfaceSwatch key={s} surface={s} theme={theme} />)}
              </div>
            </Block>

            <Block id="type" title="字體" note="標題會隨視窗縮小,但不會小於下一級。中文與西文字型成對設定。">
              <div className="flex flex-col gap-4">
                <p className="eyebrow text-accent">本週選物 · This week</p>
                <p className="heading type-display">日常裡的好東西</p>
                <p className="heading type-h1">手作的溫度,每天用得到</p>
                <p className="heading type-h2">鶯歌土生窯 · 手拉坯陶杯</p>
                <p className="heading type-h3">因為你看過咖啡器具</p>
                <p className="heading type-h4">餐桌器皿 Tableware</p>
                <p className="max-w-prose txt-large text-fg-subtle">每一只杯子都是在轆轤上拉出來的,釉色會因為窯裡的位置而有些微不同。這不是瑕疵,是它獨一無二的地方。</p>
                <p className="max-w-prose txt-medium text-fg-subtle">建議手洗;可微波,不建議放進洗碗機。容量約 280ml,適合手沖或拿鐵。</p>
                <p className="txt-small text-fg-muted">txt-small · 13/20 — 運費、退換貨說明</p>
                <p className="txt-xsmall text-fg-muted">txt-xsmall · 12/18 — 法律聲明與註記</p>
              </div>
            </Block>

            <Block id="buttons" title="按鈕">
              <div className="flex flex-col gap-4">
                {(["primary", "secondary", "accent", "ghost", "link"] as const).map((v) => (
                  <div key={v} className="flex flex-wrap items-center gap-3">
                    <span className="w-20 txt-xsmall text-fg-muted">{v}</span>
                    {(["sm", "md", "lg"] as const).map((s) => <Button key={s} variant={v} size={s}>加入購物車</Button>)}
                    <Button variant={v} loading>加入購物車</Button>
                    <Button variant={v} disabled>已售完</Button>
                  </div>
                ))}
              </div>
            </Block>

            <Block id="badges" title="徽章" note="售完 / 特價 / 少量 由程式判斷;LLM 只能加「為你挑選 / 熱賣 / 新品」,而且優先順序最低。">
              <div className="flex flex-col gap-3">
                {(["soft", "solid", "outline", "glass"] as const).map((look) => (
                  <div key={look} className="flex flex-wrap items-center gap-2">
                    <span className="w-20 txt-xsmall text-fg-muted">{look}</span>
                    {(["neutral", "accent", "success", "warning", "danger"] as BadgeTone[]).map((t) => <Badge key={t} tone={t} look={look}>{t}</Badge>)}
                  </div>
                ))}
              </div>
            </Block>

            <Block id="price" title="價格與庫存" note="打開左側「模擬即時市場」:降價閃綠、漲價閃紅,庫存變少時點會跳一下。">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <Spec label="原價"><Price amount={680} /></Spec>
                <Spec label="特價"><Price amount={920} compareAt={1150} /></Spec>
                <Spec label="大尺寸(商品頁)"><Price amount={1680} compareAt={1980} size="xl" /></Spec>
                <Spec label="重新計算中(shimmer)"><Price amount={4280} size="lg" pending /></Spec>
                <Spec label="現貨"><Stock stock={30} showOk /></Spec>
                <Spec label="少量"><Stock stock={3} /></Spec>
                <Spec label="售完"><Stock stock={0} /></Spec>
                <Spec label="即時(第一件商品)">
                  <div className="flex flex-col gap-1"><Price amount={products[0].price} compareAt={products[0].compareAt} size="lg" /><Stock stock={products[0].stock} showOk /></div>
                </Spec>
              </div>
            </Block>

            <Block id="cards" title="商品卡" note="用左側的卡片選項切換。hover 看第二張圖和快速加入;觸控裝置上快速加入一直都在。">
              <CardGrid>
                {products.map((p, i) => (
                  <ProductCard key={p.id} product={p} options={card} onQuickAdd={quickAdd} eager={i < 4} onImageStatus={track(p.id)}
                    highlight={i === 2 ? "for_you" : i === 7 ? "trending" : undefined} />
                ))}
              </CardGrid>
            </Block>

            <Block id="axes" title="卡片選項對照" note="同一件商品,只改一個選項。">
              <div className="flex flex-col gap-10">
                <Axis label="圖片比例 imageRatio" values={["portrait", "square", "landscape"] as const} render={(v) => ({ ...card, imageRatio: v })} product={products[0]} onQuickAdd={quickAdd} />
                <Axis label="資訊排列 info" values={["stacked", "row", "overlay"] as const} render={(v) => ({ ...card, info: v })} product={products[4]} onQuickAdd={quickAdd} />
                <Axis label="外框 frame" values={["bare", "card"] as const} render={(v) => ({ ...card, frame: v })} product={products[8]} onQuickAdd={quickAdd} />
                <Axis label="hover(把游標移上去)" values={["none", "second_image", "zoom"] as const} render={(v) => ({ ...card, hover: v })} product={products[16]} onQuickAdd={quickAdd} />
                <div>
                  <p className="mb-3 txt-small font-medium">徽章優先順序:售完 → 特價 → 少量 → 推薦 → 新品(「少量」只在 overlay 出現,其他排列已經有「只剩 N 件」那行)</p>
                  <CardGrid>
                    {([
                      [{ ...CATALOG[21] }, undefined, "售完"],
                      [{ ...CATALOG[1] }, "for_you", "特價(蓋過推薦)"],
                      [{ ...CATALOG[2] }, undefined, "少量"],
                      [{ ...CATALOG[0] }, "for_you", "為你挑選"],
                      [{ ...CATALOG[4] }, "trending", "熱賣"],
                      [{ ...CATALOG[3] }, undefined, "新品"],
                    ] as [CatalogProduct, Highlight | undefined, string][]).map(([p, h, label]) => (
                      <div key={label} className="flex flex-col gap-2">
                        <span className="txt-xsmall text-fg-muted">{label}</span>
                        <ProductCard product={p} options={card} highlight={h} onQuickAdd={quickAdd} />
                      </div>
                    ))}
                  </CardGrid>
                </div>
              </div>
            </Block>

            <Block id="surfaces" title="區塊底色 surface" note="每個區塊由 LLM 選底色;卡片、價格、徽章在四種底色上都要能讀。">
              <div className="-mx-6 flex flex-col">
                {(["page", "subtle", "inverse", "accent"] as SurfaceName[]).map((s) => (
                  <Surface key={s} surface={s} className="px-6 py-10">
                    <div className="mb-5 flex items-end justify-between gap-4">
                      <div>
                        <p className="eyebrow opacity-70">surface · {s}</p>
                        <h2 className="heading type-h2 mt-1">{{ page: "為你挑選", subtle: "限時降價", inverse: "快搶完了", accent: "送禮靈感" }[s]}</h2>
                      </div>
                      <Button variant="secondary" size="sm">看全部</Button>
                    </div>
                    <CardGrid>
                      {products.slice(s === "page" ? 0 : s === "subtle" ? 4 : s === "inverse" ? 12 : 8).slice(0, 4).map((p) => (
                        <ProductCard key={p.id} product={p} options={card} onQuickAdd={quickAdd} />
                      ))}
                    </CardGrid>
                  </Surface>
                ))}
              </div>
            </Block>

            <Block id="skeleton" title="骨架屏" note="只用在第一次載入。左邊骨架、右邊真的卡片,換上去時不應該有任何位移。">
              <div className="grid gap-8 sm:grid-cols-3">
                {(["stacked", "row", "overlay"] as const).map((info) => (
                  <div key={info} className="grid grid-cols-2 gap-(--gutter)">
                    <ProductCardSkeleton options={{ ...card, info }} />
                    <ProductCard product={products[5]} options={{ ...card, info }} />
                  </div>
                ))}
              </div>
            </Block>

            <Block id="images" title="圖片" note={PREVIEW ? "預覽版不能載入外部圖片,這裡會全部顯示失敗。要檢查哪些 Unsplash 圖片有效,請在本機跑。" : "圖片 id 是憑記憶挑的,建置環境連不到 Unsplash,無法事先驗證。這裡列出實際載入結果;失敗的會自動換成文字底圖。"}>
              <ImageHealth status={imageStatus.current} />
            </Block>
          </div>
        </main>
      </div>
    </ThemeScope>
  );
}

function Block({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-16">
      <header className="mb-6 max-w-3xl">
        <h2 className="heading type-h2">{title}</h2>
        {note && <p className="mt-2 txt-small text-fg-muted">{note}</p>}
      </header>
      {children}
    </section>
  );
}

function Spec({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-card bg-subtle p-4">
      <span className="txt-xsmall text-fg-muted">{label}</span>
      {children}
    </div>
  );
}

function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-(--gutter) md:grid-cols-3 xl:grid-cols-4">{children}</div>;
}

function Axis<V extends string>({ label, values, render, product, onQuickAdd }: {
  label: string; values: readonly V[]; render: (v: V) => CardOptions; product: CatalogProduct; onQuickAdd: () => Promise<void>;
}) {
  return (
    <div>
      <p className="mb-3 txt-small font-medium">{label}</p>
      <div className="grid grid-cols-2 gap-(--gutter) md:grid-cols-3 xl:grid-cols-4">
        {values.map((v) => (
          <div key={v} className="flex flex-col gap-2">
            <span className="txt-xsmall text-fg-muted">{v}</span>
            <ProductCard product={product} options={render(v)} onQuickAdd={onQuickAdd} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SurfaceSwatch({ surface, theme }: { surface: SurfaceName; theme: ThemeOptions }) {
  const v = useMemo(() => deriveVars(theme.palette, theme.scheme, surface), [theme.palette, theme.scheme, surface]);
  const rows: [string, string][] = [["--bg-subtle", "subtle"], ["--bg-component", "component"], ["--line", "line"], ["--accent", "accent"], ["--primary", "primary"]];
  const ratio = (a: string, b: string) => contrast(v[a], v[b]).toFixed(1);
  return (
    <Surface surface={surface} as="div" className="overflow-hidden rounded-card ring-1 ring-line">
      <div className="p-4">
        <p className="eyebrow opacity-70">{surface}</p>
        <p className="heading type-h3 mt-1">日常裡的好東西</p>
        <p className="txt-small text-fg-subtle">次要文字 subtle</p>
        <p className="txt-small text-fg-muted">輔助文字 muted</p>
        <div className="mt-3 flex gap-2">
          <Button size="sm">主要</Button>
          <Button size="sm" variant="accent">強調</Button>
        </div>
      </div>
      <div className="grid grid-cols-5 border-t border-line">
        {rows.map(([k, name]) => (
          <div key={k} className="flex flex-col items-center gap-1 p-2">
            <span className="h-6 w-6 rounded-full ring-1 ring-line" style={{ background: v[k] }} />
            <span className="text-[10px] text-fg-muted">{name}</span>
          </div>
        ))}
      </div>
      <dl className="grid grid-cols-3 gap-1 border-t border-line p-3 text-[11px] tabular-nums text-fg-muted">
        <Ratio label="文字" value={ratio("--fg", "--bg-base")} />
        <Ratio label="muted" value={ratio("--fg-muted", "--bg-base")} />
        <Ratio label="按鈕" value={ratio("--on-accent", "--accent")} />
      </dl>
    </Surface>
  );
}

function Ratio({ label, value }: { label: string; value: string }) {
  const ok = Number(value) >= 4.5;
  return (
    <div>
      <dt>{label}</dt>
      <dd className={cn("font-semibold", ok ? "text-fg" : "text-danger")}>{value}{ok ? "" : " ✕"}</dd>
    </div>
  );
}

function ImageHealth({ status }: { status: Map<string, ImageStatus> }) {
  const failed = CATALOG.filter((p) => status.get(p.id) === "error");
  const ok = CATALOG.filter((p) => status.get(p.id) === "ok").length;
  const pending = CATALOG.length - ok - failed.length;
  return (
    <div className="flex flex-col gap-3 txt-small">
      <div className="flex gap-4">
        <Badge tone="success">成功 {ok}</Badge>
        <Badge tone="danger">失敗 {failed.length}</Badge>
        <Badge tone="neutral">未載入 {pending}(往上捲到商品卡區)</Badge>
      </div>
      {failed.length > 0 && (
        <ul className="list-inside list-disc text-fg-subtle">
          {failed.map((p) => <li key={p.id}>{p.id} {p.name}({SHOP_CATEGORY_LABEL[p.category]})— {p.image}</li>)}
        </ul>
      )}
    </div>
  );
}
