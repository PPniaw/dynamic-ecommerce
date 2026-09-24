// Five heroes. Each opens its store with the thing that store is about:
//   spread  — editorial: one photograph and a paragraph, like a magazine opener
//   collage — collage: stickers scattered over a huge rounded headline
//   ledger  — index: no photo at all; the store's real numbers and its index
//   flash   — deal: a countdown and the three best prices right now
//   minimal — a headline and a button
import { Link } from "react-router";
import { SHOP_CATEGORIES, categoryPath, productPath, type Product } from "../../../../shared/catalog";
import type { Decision } from "../../../../shared/decision";
import { Surface } from "../../ds/theme/ThemeScope";
import { Button } from "../../ds/ui/Button";
import { cn } from "../../ds/ui/cn";
import { Price, formatMoney } from "../../ds/ui/Price";
import { ProductImage } from "../../ds/ui/ProductImage";
import { CATEGORY_COPY, HEADLINE_COPY } from "../copy";
import { useStore } from "../StoreContext";
import { DealCard, useCardActions } from "../cards/Cards";
import { useCountdown } from "./Header";

export function Hero({ hero, products }: { hero: Decision["hero"]; products: Product[] }) {
  const copy = HEADLINE_COPY[hero.headline];
  switch (hero.variant) {
    case "spread": return <Spread copy={copy} p={products[0]} />;
    case "collage": return <Collage copy={copy} products={products} />;
    case "ledger": return <Ledger copy={copy} />;
    case "flash": return <Flash copy={copy} products={products} />;
    default: return <Minimal copy={copy} />;
  }
}

type Copy = (typeof HEADLINE_COPY)[keyof typeof HEADLINE_COPY];

function Spread({ copy, p }: { copy: Copy; p?: Product }) {
  const a = useCardActions();
  return (
    <section className="page grid items-center gap-10 pt-10 md:grid-cols-[1.1fr_1fr] md:gap-16 md:pt-16">
      {p && (
        <button type="button" onClick={() => a.open(p)} className="group/card card-hover block cursor-pointer overflow-hidden rounded-card" aria-label={p.name}>
          <ProductImage image={p.image} name={p.name} ratio="portrait" width={1000} eager />
        </button>
      )}
      <div className="flex max-w-lg flex-col gap-6">
        <p className="eyebrow text-fg-muted">{copy.eyebrow} · Vol. 38</p>
        <h1 className="heading type-display">{copy.title}</h1>
        <p className="txt-large text-fg-subtle">{copy.body}</p>
        {p && (
          <div className="flex flex-col gap-1 border-t border-line pt-5">
            <p className="txt-small text-fg-muted">{p.maker}</p>
            <Link to={productPath(p)} className="heading type-h3 hover:underline hover:underline-offset-4">{p.name}</Link>
            <Price amount={p.price} compareAt={p.compareAt} />
          </div>
        )}
        <Link to={p ? productPath(p) : "/"} className="txt-medium font-medium underline decoration-line-strong underline-offset-8 hover:decoration-fg">閱讀它的故事 →</Link>
      </div>
    </section>
  );
}

// Stickers live in the four corners so the headline and buttons stay clear.
const SCATTER = [
  "left-[1%] top-[4%] w-[22%] -rotate-6",
  "right-[2%] top-[0%] w-[20%] rotate-[5deg]",
  "left-[5%] bottom-[2%] w-[18%] rotate-3",
  "right-[6%] bottom-[4%] w-[19%] -rotate-[8deg]",
];

function Collage({ copy, products }: { copy: Copy; products: Product[] }) {
  const a = useCardActions();
  const surprise = () => {
    const live = products.filter((p) => p.stock > 0);
    if (live.length) a.open(live[Math.floor(Math.random() * live.length)]);
  };
  return (
    <section className="page relative pt-6">
      <div className="relative md:min-h-[640px]">
        <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center gap-6 pt-10 text-center md:pt-36">
          <p className="rotate-2 rounded-full bg-accent px-4 py-1.5 txt-medium font-bold text-on-accent ring-2 ring-fg">{copy.eyebrow}</p>
          <h1 className="heading text-[clamp(44px,7vw,104px)] leading-[0.95]">{copy.title}</h1>
          <p className="max-w-md txt-large text-fg-subtle">{copy.body}</p>
          <div className="flex gap-3">
            <Button size="lg" onClick={() => document.getElementById("s0")?.scrollIntoView({ behavior: "smooth" })}>隨便逛逛</Button>
            <Button size="lg" variant="accent" onClick={surprise}>給我驚喜 ✦</Button>
          </div>
        </div>
        {products.slice(0, 4).map((p, i) => (
          <button key={p.id} type="button" onClick={() => a.open(p)} aria-label={p.name}
            className={cn("absolute hidden cursor-pointer transition-transform duration-300 ease-(--ease-bounce) hover:z-20 hover:scale-105 hover:rotate-0 md:block", SCATTER[i])}>
            <span className="block overflow-hidden rounded-card bg-base p-2 shadow-[5px_5px_0_0_var(--fg)] ring-2 ring-fg">
              <ProductImage image={p.image} name={p.name} ratio="square" width={500} eager className="rounded-media" />
            </span>
            <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 rotate-[-4deg] rounded-full bg-fg px-3 py-1 txt-small font-bold whitespace-nowrap text-(--bg-base) tabular-nums">
              {formatMoney(p.price)}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Ledger({ copy }: { copy: Copy }) {
  const { products } = useStore();
  const all = [...products.values()];
  const stats: [string, string][] = [
    ["Items", String(all.length)],
    ["In stock", String(all.filter((p) => p.stock > 0).length)],
    ["Low stock", String(all.filter((p) => p.stock > 0 && p.stock <= 5).length)],
    ["Below list", String(all.filter((p) => p.compareAt).length)],
    ["Median", all.length ? formatMoney([...all].sort((x, y) => x.price - y.price)[Math.floor(all.length / 2)].price) : "—"],
    ["Sold today", String(all.reduce((s, p) => s + p.sold, 0))],
  ];
  return (
    <section className="page pt-8">
      <div className="grid gap-8 border-b border-fg pb-8 md:grid-cols-[1fr_auto]">
        <div>
          <p className="eyebrow text-fg-muted">{copy.eyebrow} — {new Date().toLocaleDateString("zh-TW")}</p>
          <h1 className="heading mt-2 type-display">{copy.title}</h1>
          <p className="mt-3 max-w-xl txt-medium text-fg-subtle">{copy.body}</p>
        </div>
        <dl className="grid grid-cols-3 gap-x-8 gap-y-4 self-end md:grid-cols-2">
          {stats.map(([k, v]) => (
            <div key={k}>
              <dt className="txt-xsmall uppercase tracking-wider text-fg-muted">{k}</dt>
              <dd className="txt-xlarge font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <ol className="grid grid-cols-2 border-b border-line md:grid-cols-6">
        {SHOP_CATEGORIES.map((c, i) => (
          <li key={c} className="border-line not-last:border-r">
            <Link to={categoryPath(c)} className="flex flex-col gap-1 p-3 transition-colors hover:bg-subtle">
              <span className="txt-xsmall text-fg-muted tabular-nums">{String(i + 1).padStart(2, "0")} · {all.filter((p) => p.category === c).length} items</span>
              <span className="txt-small font-semibold uppercase">{CATEGORY_COPY[c].en}</span>
              <span className="txt-xsmall text-fg-subtle">{CATEGORY_COPY[c].label}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Flash({ copy, products }: { copy: Copy; products: Product[] }) {
  const t = useCountdown();
  return (
    <Surface surface="accent" className="py-8">
      <div className="page grid items-center gap-8 lg:grid-cols-[1fr_2fr]">
        <div className="flex flex-col gap-4">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1 className="heading type-display">{copy.title}</h1>
          <div className="flex items-baseline gap-3">
            <span className="txt-small">本輪結束還有</span>
            <span className="font-mono text-[44px] leading-none font-bold tabular-nums">{t}</span>
          </div>
          <p className="txt-medium text-fg-subtle">{copy.body}</p>
        </div>
        <div className="grid grid-cols-2 gap-(--gutter) sm:grid-cols-3">
          {products.slice(0, 3).map((p) => <DealCard key={p.id} p={p} />)}
        </div>
      </div>
    </Surface>
  );
}

function Minimal({ copy }: { copy: Copy }) {
  return (
    <section className="page flex flex-col items-start gap-5 pt-16">
      <p className="eyebrow text-fg-muted">{copy.eyebrow}</p>
      <h1 className="heading type-display max-w-3xl">{copy.title}</h1>
      <p className="max-w-xl txt-large text-fg-subtle">{copy.body}</p>
    </section>
  );
}
