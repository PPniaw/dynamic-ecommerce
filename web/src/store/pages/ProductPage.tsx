// Product page. Gallery and info panel come from the decision (`product`):
//   gallery: stack (editorial: photos down the page) | carousel (thumbnails) | grid (2×2 crops)
//   info:    story (maker's story first) | specs (a spec sheet + comparison) | buybox (price first)
// Plus Horizon's sticky add-to-cart bar on phones, shown only once the real
// button has scrolled away.
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { categoryPath, productIdFromSlug, type Product } from "../../../../shared/catalog";
import type { Decision } from "../../../../shared/decision";
import { Badge } from "../../ds/ui/Badge";
import { Button } from "../../ds/ui/Button";
import { cn } from "../../ds/ui/cn";
import { Price, formatMoney } from "../../ds/ui/Price";
import { ProductImage } from "../../ds/ui/ProductImage";
import { Stock, stockLevel } from "../../ds/ui/Stock";
import { CATEGORY_COPY, STORY_COPY } from "../copy";
import { Rail, SectionHead } from "../sections/Rail";
import { useCountdown } from "../sections/Header";
import { useStore } from "../StoreContext";
import { highlightMap } from "./Home";
import { NotFound } from "./CategoryPage";

export function ProductPage() {
  const { slug = "" } = useParams();
  const { envelope, products, view } = useStore();
  const id = productIdFromSlug(slug);
  const p = products.get(id);
  // One view event per product page visit — it's a real signal for the engine.
  useEffect(() => { if (p) view(p.id); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const buyRef = useRef<HTMLDivElement>(null);
  const [buyVisible, setBuyVisible] = useState(true);
  useEffect(() => {
    const el = buyRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setBuyVisible(e.isIntersecting || e.boundingClientRect.top > 0));
    io.observe(el);
    return () => io.disconnect();
  }, [p?.id]);

  if (!envelope) return null;
  if (!p) return <NotFound />;
  const d = envelope.decision;
  const related = [...products.values()].filter((x) => x.category === p.category && x.id !== p.id);

  return (
    <div className="page pt-6">
      <nav className="mb-6 txt-small text-fg-muted">
        <Link to="/" className="hover:text-fg">首頁</Link> / <Link to={categoryPath(p.category)} className="hover:text-fg">{CATEGORY_COPY[p.category].label}</Link>
      </nav>
      <div className={cn("grid gap-10", d.product.gallery === "stack" ? "md:grid-cols-[1.3fr_1fr]" : "md:grid-cols-2", "lg:gap-16")}>
        <Gallery p={p} kind={d.product.gallery} />
        <div className="md:sticky md:top-24 md:self-start">
          {d.product.info === "story" && <StoryInfo p={p} buyRef={buyRef} />}
          {d.product.info === "specs" && <SpecsInfo p={p} buyRef={buyRef} related={related} />}
          {d.product.info === "buybox" && <BuyBox p={p} buyRef={buyRef} />}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-(--section-gap)">
          <SectionHead archetype={d.archetype} title={`更多${CATEGORY_COPY[p.category].label}`} sub={CATEGORY_COPY[p.category].en} />
          <Rail layout={d.listing.layout === "table" ? "table" : "carousel"} products={related} card={d.card} highlights={highlightMap(d)} />
        </section>
      )}

      <MobileBuyBar p={p} show={!buyVisible} />
    </div>
  );
}

function Gallery({ p, kind }: { p: Product; kind: Decision["product"]["gallery"] }) {
  const shots = [
    { ratio: "portrait" as const, detail: false },
    { ratio: "square" as const, detail: true },
    { ratio: "landscape" as const, detail: false },
    { ratio: "square" as const, detail: false },
  ];
  const [i, setI] = useState(0);
  if (kind === "stack") {
    return (
      <div className="flex flex-col gap-(--gutter)">
        {shots.slice(0, 3).map((s, k) => (
          <ProductImage key={k} image={p.image} name={p.name} ratio={s.ratio} detail={s.detail} width={1100} eager={k === 0} className="rounded-media" />
        ))}
      </div>
    );
  }
  if (kind === "grid") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {shots.map((s, k) => (
          <ProductImage key={k} image={p.image} name={k === 0 ? p.name : ""} ratio="square" detail={s.detail} width={700} eager={k === 0} quietFallback={k > 0} className="rounded-media" />
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <ProductImage key={i} image={p.image} name={p.name} ratio="square" detail={shots[i].detail} width={1000} eager className="animate-fade-in rounded-card" />
      <div className="flex gap-2">
        {shots.map((s, k) => (
          <button key={k} type="button" onClick={() => setI(k)} aria-label={`第 ${k + 1} 張`} aria-current={i === k}
            className={cn("w-16 cursor-pointer overflow-hidden rounded-media ring-offset-2 ring-offset-(--bg-base) transition", i === k ? "ring-2 ring-fg" : "opacity-60 hover:opacity-100")}>
            <ProductImage image={p.image} name="" ratio="square" detail={s.detail} width={160} quietFallback />
          </button>
        ))}
      </div>
    </div>
  );
}

function AddToCart({ p, size = "lg" }: { p: Product; size?: "md" | "lg" }) {
  const { add } = useStore();
  const [busy, setBusy] = useState(false);
  const out = stockLevel(p.stock) === "out";
  return (
    <Button size={size} block disabled={out} loading={busy} onClick={async () => { setBusy(true); try { await add(p.id); } finally { setBusy(false); } }}>
      {out ? "已售完" : "加入購物車"}
    </Button>
  );
}

function StoryInfo({ p, buyRef }: { p: Product; buyRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div className="flex flex-col gap-6">
      <p className="eyebrow text-fg-muted">{p.maker}</p>
      <h1 className="heading type-h1">{p.name}</h1>
      <Price amount={p.price} compareAt={p.compareAt} size="lg" />
      <p className="txt-large leading-8 text-fg-subtle">{STORY_COPY[p.category]}</p>
      <div ref={buyRef} className="flex flex-col gap-2">
        <AddToCart p={p} />
        <Stock stock={p.stock} showOk />
      </div>
      <dl className="divide-y divide-line border-y border-line txt-small">
        <Detail label="產地與工坊">{p.maker}</Detail>
        <Detail label="運送">三個工作天內出貨,滿 NT$1,500 免運</Detail>
        <Detail label="退換">收到七天內可退換,手作品的細微差異不在退換範圍</Detail>
      </dl>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="group py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between">
        {label}
        {/* plus → minus (Medusa's morphing trigger) */}
        <span aria-hidden className="relative h-3 w-3">
          <span className="absolute top-1/2 left-0 h-px w-3 bg-fg" />
          <span className="absolute top-0 left-1/2 h-3 w-px bg-fg transition-transform group-open:rotate-90" />
        </span>
      </summary>
      <p className="pt-2 text-fg-subtle">{children}</p>
    </details>
  );
}

function SpecsInfo({ p, buyRef, related }: { p: Product; buyRef: React.RefObject<HTMLDivElement | null>; related: Product[] }) {
  const rows: [string, React.ReactNode][] = [
    ["Maker", p.maker],
    ["Category", `${CATEGORY_COPY[p.category].en} / ${CATEGORY_COPY[p.category].label}`],
    ["List price", formatMoney(p.compareAt ?? p.price)],
    ["Price", <Price key="p" amount={p.price} compareAt={p.compareAt} size="sm" />],
    ["Stock", <span key="s" className="tabular-nums">{p.stock}</span>],
    ["Sold", <span key="d" className="tabular-nums">{p.sold}</span>],
    ["Tags", p.tags.join(" · ")],
    ["SKU", p.id.toUpperCase()],
  ];
  const cmp = [p, ...related.slice(0, 2)];
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="txt-xsmall uppercase tracking-wider text-fg-muted">{p.id.toUpperCase()} · {CATEGORY_COPY[p.category].en}</p>
        <h1 className="heading mt-1 type-h1">{p.name}</h1>
      </div>
      <table className="w-full border-t border-fg txt-small">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-line">
              <th className="w-32 py-2 text-left font-normal uppercase tracking-wider text-fg-muted">{k}</th>
              <td className="py-2">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div ref={buyRef}><AddToCart p={p} size="md" /></div>
      {cmp.length > 1 && (
        <div className="overflow-x-auto">
          <p className="mb-2 txt-xsmall uppercase tracking-wider text-fg-muted">Compare / 同類比較</p>
          <table className="w-full txt-xsmall">
            <thead>
              <tr className="border-b border-fg text-left text-fg-muted">
                <th className="py-1.5 pr-3 font-normal" />
                {cmp.map((x) => <th key={x.id} className={cn("py-1.5 pr-3 font-medium", x.id === p.id && "text-fg")}>{x.name}</th>)}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <CmpRow label="Price" cells={cmp.map((x) => formatMoney(x.price))} />
              <CmpRow label="Stock" cells={cmp.map((x) => String(x.stock))} />
              <CmpRow label="Sold" cells={cmp.map((x) => String(x.sold))} />
              <CmpRow label="Maker" cells={cmp.map((x) => x.maker)} />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CmpRow({ label, cells }: { label: string; cells: string[] }) {
  return (
    <tr className="border-b border-line">
      <th className="py-1.5 pr-3 text-left font-normal uppercase text-fg-muted">{label}</th>
      {cells.map((c, i) => <td key={i} className={cn("py-1.5 pr-3", i === 0 && "font-semibold")}>{c}</td>)}
    </tr>
  );
}

function BuyBox({ p, buyRef }: { p: Product; buyRef: React.RefObject<HTMLDivElement | null> }) {
  const t = useCountdown();
  const { setQty, cart } = useStore();
  const inCart = cart.find((l) => l.productId === p.id)?.qty ?? 0;
  const off = p.compareAt ? Math.round((1 - p.price / p.compareAt) * 100) : 0;
  const soldPct = Math.round((p.sold / Math.max(1, p.sold + p.stock)) * 100);
  return (
    <div className="flex flex-col gap-5 rounded-card bg-subtle p-6">
      <div className="flex items-center gap-2">
        {off > 0 && <Badge tone="accent" look="solid" size="md">省 {off}%</Badge>}
        {off > 0 && <span className="txt-small text-fg-subtle">降價倒數 <span className="font-mono font-semibold tabular-nums text-fg">{t}</span></span>}
      </div>
      <h1 className="heading type-h2">{p.name}</h1>
      <Price amount={p.price} compareAt={p.compareAt} size="xl" />
      <div className="flex flex-col gap-1.5">
        <div className="h-2 overflow-hidden rounded-full bg-component">
          <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${soldPct}%` }} />
        </div>
        <div className="flex justify-between txt-small tabular-nums">
          <span className="text-fg-muted">已售 {p.sold} 件</span>
          <Stock stock={p.stock} showOk />
        </div>
      </div>
      <div ref={buyRef} className="flex gap-2">
        {inCart > 0 && (
          <div className="flex h-12 items-center rounded-control ring-1 ring-line-strong">
            <button type="button" className="h-full w-10 cursor-pointer" onClick={() => setQty(p.id, inCart - 1)} aria-label="減少">−</button>
            <span className="w-8 text-center tabular-nums">{inCart}</span>
            <button type="button" className="h-full w-10 cursor-pointer" disabled={inCart >= p.stock} onClick={() => setQty(p.id, inCart + 1)} aria-label="增加">+</button>
          </div>
        )}
        <div className="grow"><AddToCart p={p} /></div>
      </div>
      <ul className="grid grid-cols-2 gap-2 txt-small text-fg-subtle">
        <li>✓ 24 小時內出貨</li>
        <li>✓ 滿 NT$1,500 免運</li>
        <li>✓ 七天鑑賞期</li>
        <li>✓ 可開統編</li>
      </ul>
    </div>
  );
}

function MobileBuyBar({ p, show }: { p: Product; show: boolean }) {
  return (
    <div className={cn(
      "fixed inset-x-0 bottom-0 z-30 border-t border-line bg-base/95 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] backdrop-blur-md transition-transform duration-200 md:hidden",
      show ? "translate-y-0" : "translate-y-full",
    )} aria-hidden={!show}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 grow">
          <p className="truncate txt-small">{p.name}</p>
          <Price amount={p.price} compareAt={p.compareAt} size="sm" showDiscount={false} />
        </div>
        <div className="w-36"><AddToCart p={p} size="md" /></div>
      </div>
    </div>
  );
}
