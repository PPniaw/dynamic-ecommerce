// A list of products in one of six layouts. The same list reads as a
// magazine spread, a sticker collage, a spec table or a bargain wall.
import { useMemo, useRef, useState, type ReactNode } from "react";
import type { Product } from "../../../../shared/catalog";
import type { Archetype, Decision, RailLayout } from "../../../../shared/decision";
import { cn } from "../../ds/ui/cn";
import type { Highlight } from "../../ds/ui/ProductCard";
import { Card, DealCard, ProductRow, StickerCard } from "../cards/Cards";

export function Rail({ layout, products, card, highlights }: {
  layout: RailLayout; products: Product[]; card: Decision["card"]; highlights: Map<string, Highlight>;
}) {
  const hl = (id: string) => highlights.get(id);
  switch (layout) {
    case "table":
      return <TableRail products={products} />;
    case "bento":
      return <BentoRail products={products} hl={hl} />;
    case "dense":
      return (
        <div className="grid grid-cols-2 gap-(--gutter) sm:grid-cols-3 lg:grid-cols-5">
          {products.map((p) => <DealCard key={p.id} p={p} highlight={hl(p.id)} />)}
        </div>
      );
    case "editorial":
      return <EditorialRail products={products} card={card} hl={hl} />;
    case "carousel":
      return <Carousel>{products.map((p, i) => <div key={p.id} className="w-[46vw] shrink-0 snap-start sm:w-64"><Card product={p} card={card} highlight={hl(p.id)} index={i} /></div>)}</Carousel>;
    case "grid":
    default:
      return (
        <div className="grid grid-cols-2 gap-(--gutter) md:grid-cols-3 lg:grid-cols-4">
          {products.map((p, i) => <Card key={p.id} product={p} card={card} highlight={hl(p.id)} index={i} />)}
        </div>
      );
  }
}

// Magazine rhythm: one lead image spanning two columns and two rows, the rest
// offset so the page reads like a spread, not a catalogue.
function EditorialRail({ products, card, hl }: { products: Product[]; card: Decision["card"]; hl: (id: string) => Highlight | undefined }) {
  const [lead, ...rest] = products;
  if (!lead) return null;
  return (
    <div className="grid grid-cols-2 gap-x-(--gutter) gap-y-12 md:grid-cols-4">
      <div className="col-span-2 md:row-span-2">
        <Card product={lead} card={{ ...card, imageRatio: "portrait" }} highlight={hl(lead.id)} eager />
      </div>
      {rest.map((p, i) => (
        <div key={p.id} className={cn(i % 2 === 1 && "md:mt-16")}>
          <Card product={p} card={card} highlight={hl(p.id)} />
        </div>
      ))}
    </div>
  );
}

// Collage: mixed tile sizes on a 4-column grid; big tiles every few items.
const BENTO = ["md:col-span-2 md:row-span-2", "", "", "md:row-span-2", "md:col-span-2", "", ""];
function BentoRail({ products, hl }: { products: Product[]; hl: (id: string) => Highlight | undefined }) {
  return (
    <div className="grid auto-rows-[minmax(0,auto)] grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
      {products.map((p, i) => (
        <div key={p.id} className={BENTO[i % BENTO.length]}>
          <StickerCard p={p} index={i} highlight={hl(p.id)} big={BENTO[i % BENTO.length].includes("row-span-2")} />
        </div>
      ))}
    </div>
  );
}

// Index: a sortable spec table. Numbers are real (row order), not decoration.
type SortKey = "rank" | "price" | "stock" | "discount";
function TableRail({ products }: { products: Product[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "rank", dir: 1 });
  const rows = useMemo(() => {
    const val = (p: Product, i: number) => ({
      rank: i, price: p.price, stock: p.stock, discount: p.compareAt ? 1 - p.price / p.compareAt : 0,
    })[sort.key];
    return products.map((p, i) => ({ p, v: val(p, i) })).sort((a, b) => (a.v - b.v) * sort.dir).map((x) => x.p);
  }, [products, sort]);
  const th = (key: SortKey, label: string, cls = "") => (
    <th className={cn("py-2 pr-3 font-medium", cls)} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" className="cursor-pointer uppercase hover:text-fg" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : 1 }))}>
        {label}{sort.key === key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead className="border-y border-line-strong txt-xsmall tracking-wider text-fg-muted">
          <tr>
            {th("rank", "#", "w-8")}
            <th className="py-2 pr-3 font-medium uppercase">Item</th>
            <th className="hidden py-2 pr-3 font-medium uppercase sm:table-cell">Maker</th>
            <th className="hidden py-2 pr-3 font-medium uppercase md:table-cell">Type</th>
            {th("price", "Price", "text-right")}
            {th("stock", "Stock", "hidden text-right lg:table-cell")}
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>{rows.map((p) => <ProductRow key={p.id} p={p} n={products.indexOf(p) + 1} />)}</tbody>
      </table>
    </div>
  );
}

export function Carousel({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <div className="relative">
      <div ref={ref} className="-mx-4 flex snap-x snap-mandatory gap-(--gutter) overflow-x-auto scroll-px-4 px-4 pt-3 pb-4 [scrollbar-width:none] md:-mx-10 md:scroll-px-10 md:px-10">
        {children}
      </div>
      <div className="pointer-events-none absolute -top-14 right-0 hidden gap-2 md:flex">
        {([-1, 1] as const).map((d) => (
          <button key={d} type="button" onClick={() => scroll(d)} aria-label={d < 0 ? "上一組" : "下一組"}
            className="pointer-events-auto grid h-9 w-9 cursor-pointer place-items-center rounded-control ring-1 ring-line-strong transition-colors hover:bg-component">
            <svg viewBox="0 0 16 16" className={cn("h-4 w-4", d < 0 && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 3l5 5-5 5" /></svg>
          </button>
        ))}
      </div>
    </div>
  );
}

// Section title in each store's voice and typographic habit.
export function SectionHead({ archetype, title, sub, action }: { archetype: Archetype; title: string; sub?: string; action?: ReactNode }) {
  if (archetype === "index") {
    return (
      <div className="mb-3 flex items-baseline justify-between gap-4 border-b border-fg pb-2">
        <h2 className="heading txt-large">{title}</h2>
        <div className="flex items-baseline gap-4 txt-xsmall text-fg-muted">{sub}{action}</div>
      </div>
    );
  }
  if (archetype === "collage") {
    return (
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="heading type-h1 inline-block -rotate-1">{title}</h2>
          {sub && <p className="mt-2 inline-block rotate-1 rounded-full bg-accent px-3 py-1 txt-small font-medium text-on-accent">{sub}</p>}
        </div>
        {action}
      </div>
    );
  }
  if (archetype === "deal") {
    return (
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h2 className="heading type-h3">{title}</h2>
          {sub && <span className="txt-small text-fg-muted">{sub}</span>}
        </div>
        {action}
      </div>
    );
  }
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
      <div>
        {sub && <p className="eyebrow mb-3 text-fg-muted">{sub}</p>}
        <h2 className="heading type-h1">{title}</h2>
      </div>
      {action}
    </div>
  );
}
