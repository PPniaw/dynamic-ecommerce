// Non-rail sections: maker story, marquee, category tiles, promo, live ticker.
import { Link } from "react-router";
import { SHOP_CATEGORIES, categoryPath, productPath, type Product } from "../../../../shared/catalog";
import type { Archetype, Section } from "../../../../shared/decision";
import { cn } from "../../ds/ui/cn";
import { Price, formatMoney } from "../../ds/ui/Price";
import { ProductImage } from "../../ds/ui/ProductImage";
import { CATEGORY_COPY, FREE_SHIPPING, STORY_COPY } from "../copy";
import { useStore } from "../StoreContext";
import { useCountdown } from "./Header";

// Editorial: a maker's story with the lead product's photo. The one place in
// the store with a paragraph of prose — it's what this archetype sells.
export function Story({ products }: { products: Product[] }) {
  const [lead, ...more] = products;
  if (!lead) return null;
  return (
    <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
      <Link to={productPath(lead)} className="group/card card-hover block overflow-hidden rounded-card">
        <ProductImage image={lead.image} name={lead.name} ratio="landscape" width={1000} />
      </Link>
      <div className="flex max-w-lg flex-col gap-5">
        <p className="eyebrow text-fg-muted">製作的人 · {lead.maker}</p>
        <h3 className="heading type-h1">{lead.maker.split(" · ")[1] ?? lead.maker}</h3>
        <p className="txt-large leading-8 text-fg-subtle">{STORY_COPY[lead.category]}</p>
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {[lead, ...more].slice(0, 3).map((p) => (
            <li key={p.id}>
              <Link to={productPath(p)} className="flex items-baseline justify-between gap-4 py-3 hover:underline hover:underline-offset-4">
                <span className="txt-medium">{p.name}</span>
                <Price amount={p.price} compareAt={p.compareAt} size="sm" showDiscount={false} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Collage: an endless strip of names and prices. Pauses on hover.
export function Marquee({ products }: { products: Product[] }) {
  if (!products.length) return null;
  const run = products.map((p) => (
    <Link key={p.id} to={productPath(p)} className="flex shrink-0 items-center gap-3 px-6 hover:underline">
      <span className="heading type-h3">{p.name}</span>
      <span className="rounded-full bg-fg px-2.5 py-0.5 txt-small font-bold text-(--bg-base) tabular-nums">{formatMoney(p.price)}</span>
      <span aria-hidden className="h-2 w-2 rotate-45 bg-fg" />
    </Link>
  ));
  return (
    <div className="group/marquee overflow-hidden" aria-label="熱門商品">
      {/* content twice + translate -50% = seamless loop (the fix Vercel's marquee needed) */}
      <div className="flex w-max animate-marquee group-hover/marquee:[animation-play-state:paused]">{run}{run}</div>
    </div>
  );
}

export function Categories({ archetype, layout }: { archetype: Archetype; layout: Section["layout"] }) {
  const { products } = useStore();
  const lead = (c: string) => [...products.values()].find((p) => p.category === c && p.stock > 0);
  if (archetype === "collage" || layout === "bento") {
    return (
      <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
        {SHOP_CATEGORIES.map((c, i) => {
          const p = lead(c);
          return (
            <Link key={c} to={categoryPath(c)} style={{ rotate: `${[-2, 1.5, -1, 2, -1.5, 1][i]}deg` }}
              className="group/card relative flex items-center gap-3 overflow-hidden rounded-card bg-base p-3 ring-2 ring-fg shadow-[4px_4px_0_0_var(--fg)] transition-transform hover:rotate-0! hover:-translate-y-1">
              {p && <span className="w-16 shrink-0 overflow-hidden rounded-full ring-2 ring-fg"><ProductImage image={p.image} name="" ratio="square" width={160} quietFallback /></span>}
              <span>
                <span className="heading block txt-xlarge">{CATEGORY_COPY[c].label}</span>
                <span className="txt-xsmall text-fg-muted">{CATEGORY_COPY[c].blurb}</span>
              </span>
            </Link>
          );
        })}
      </div>
    );
  }
  // Editorial / others: a quiet typographic index.
  return (
    <ul className="grid border-t border-line md:grid-cols-2">
      {SHOP_CATEGORIES.map((c) => (
        <li key={c} className="border-b border-line md:odd:border-r md:odd:pr-8 md:even:pl-8">
          <Link to={categoryPath(c)} className="group flex items-baseline justify-between gap-4 py-5">
            <span className="heading type-h2 transition-transform group-hover:translate-x-2">{CATEGORY_COPY[c].label}</span>
            <span className="txt-small text-fg-muted">{CATEGORY_COPY[c].en}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// Deal: free-shipping progress + countdown, driven by the live cart.
export function Promo() {
  const { cart, products } = useStore();
  const t = useCountdown();
  const total = cart.reduce((s, l) => s + (products.get(l.productId)?.price ?? 0) * l.qty, 0);
  const left = Math.max(0, FREE_SHIPPING - total);
  const pct = Math.min(100, Math.round((total / FREE_SHIPPING) * 100));
  return (
    <div className="grid items-center gap-6 md:grid-cols-[1fr_auto]">
      <div className="flex flex-col gap-2">
        <p className="heading type-h3">{left > 0 ? `再買 ${formatMoney(left)} 就免運` : "已達免運門檻!"}</p>
        <div className="h-2.5 overflow-hidden rounded-full bg-fg/15">
          <div className="h-full rounded-full bg-fg transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="txt-small text-fg-subtle tabular-nums">購物車 {formatMoney(total)} / {formatMoney(FREE_SHIPPING)}</p>
      </div>
      <div className="flex items-baseline gap-3">
        <span className="txt-small">降價倒數</span>
        <span className="font-mono text-[40px] leading-none font-bold tabular-nums">{t}</span>
      </div>
    </div>
  );
}

// Collage: other shoppers, live. The store is visibly busy.
export function Ticker() {
  const { activity, products } = useStore();
  const items = activity.slice(0, 12);
  if (!items.length) return <p className="txt-small text-fg-muted">等其他人的動作中…</p>;
  const text = (i: (typeof items)[number]) => {
    const n = products.get(i.productId)?.name ?? "";
    return { sold: `有人剛買了 ${i.qty} 件「${n}」`, sold_out: `「${n}」剛剛賣完`, restock: `「${n}」補貨了!`, price_drop: `「${n}」降到 ${formatMoney(i.to!)}`, price_up: `「${n}」漲到 ${formatMoney(i.to!)}` }[i.kind];
  };
  return (
    <div className="overflow-hidden" aria-live="polite">
      <div className="flex w-max animate-marquee gap-10 [animation-duration:60s]">
        {[...items, ...items].map((i, k) => (
          <span key={k} className={cn("shrink-0 txt-medium", i.kind === "price_drop" && "text-accent font-semibold")}>{text(i)}</span>
        ))}
      </div>
    </div>
  );
}
