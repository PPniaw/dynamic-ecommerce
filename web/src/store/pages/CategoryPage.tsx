// Category page. Layout and filter placement come from the decision
// (`listing`); filters and sort are the shopper's, kept in the URL.
import { Link, useParams, useSearchParams } from "react-router";
import { SHOP_CATEGORIES, categoryPath, type Product, type ShopCategory } from "../../../../shared/catalog";
import { cn } from "../../ds/ui/cn";
import { CATEGORY_COPY } from "../copy";
import { Rail } from "../sections/Rail";
import { useStore } from "../StoreContext";
import { highlightMap } from "./Home";

const SORTS = [["featured", "推薦"], ["price_asc", "價格低→高"], ["price_desc", "價格高→低"], ["discount", "折扣"]] as const;
const PRICES = [["all", "全部價位"], ["u500", "NT$500 以下"], ["500-1500", "NT$500–1,500"], ["o1500", "NT$1,500 以上"]] as const;

export function CategoryPage() {
  const { category } = useParams();
  const [params, setParams] = useSearchParams();
  const { envelope, products } = useStore();
  if (!envelope || !SHOP_CATEGORIES.includes(category as ShopCategory)) return <NotFound />;
  const d = envelope.decision;
  const cat = category as ShopCategory;
  const copy = CATEGORY_COPY[cat];
  const sort = params.get("sort") ?? "featured";
  const price = params.get("price") ?? "all";
  const inStock = params.get("stock") === "1";
  const set = (k: string, v: string | null) => setParams((p) => { const n = new URLSearchParams(p); if (v === null) n.delete(k); else n.set(k, v); return n; }, { replace: true, preventScrollReset: true });

  let items = [...products.values()].filter((p) => p.category === cat);
  if (inStock) items = items.filter((p) => p.stock > 0);
  if (price === "u500") items = items.filter((p) => p.price < 500);
  if (price === "500-1500") items = items.filter((p) => p.price >= 500 && p.price <= 1500);
  if (price === "o1500") items = items.filter((p) => p.price > 1500);
  const disc = (p: Product) => (p.compareAt ? 1 - p.price / p.compareAt : 0);
  if (sort === "price_asc") items.sort((a, b) => a.price - b.price);
  if (sort === "price_desc") items.sort((a, b) => b.price - a.price);
  if (sort === "discount") items.sort((a, b) => disc(b) - disc(a));

  const filters = (
    <Filters layout={d.listing.filters} sort={sort} price={price} inStock={inStock} set={set} current={cat} />
  );
  const grid = <Rail layout={d.listing.layout} products={items} card={d.card} highlights={highlightMap(d)} />;

  return (
    <div className="page pt-8">
      <PageTitle archetype={d.archetype} title={copy.label} en={copy.en} blurb={copy.blurb} count={items.length} />
      {d.listing.filters === "sidebar" ? (
        <div className="grid gap-8 md:grid-cols-[200px_1fr]">
          <aside className="md:sticky md:top-20 md:self-start">{filters}</aside>
          <div>{items.length ? grid : <Empty />}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {filters}
          {items.length ? grid : <Empty />}
        </div>
      )}
    </div>
  );
}

function PageTitle({ archetype, title, en, blurb, count }: { archetype: string; title: string; en: string; blurb: string; count: number }) {
  if (archetype === "index") {
    return (
      <div className="mb-6 flex items-end justify-between border-b border-fg pb-3">
        <div>
          <p className="txt-xsmall uppercase tracking-wider text-fg-muted"><Link to="/" className="hover:text-fg">Index</Link> / {en}</p>
          <h1 className="heading mt-1 type-h1">{en} <span className="text-fg-muted">/ {title}</span></h1>
        </div>
        <p className="txt-small tabular-nums text-fg-muted">{count} items</p>
      </div>
    );
  }
  if (archetype === "collage") {
    return (
      <div className="mb-10 text-center">
        <p className="inline-block rotate-2 rounded-full bg-accent px-3 py-1 txt-small font-bold text-on-accent ring-2 ring-fg">{count} 件好物</p>
        <h1 className="heading mt-4 text-[clamp(44px,8vw,96px)] leading-none">{title}</h1>
        <p className="mt-3 txt-large text-fg-subtle">{blurb}</p>
      </div>
    );
  }
  if (archetype === "deal") {
    return (
      <div className="mb-4 flex items-baseline gap-3">
        <h1 className="heading type-h2">{title}</h1>
        <span className="txt-small text-fg-muted tabular-nums">共 {count} 件</span>
      </div>
    );
  }
  return (
    <div className="mb-14 max-w-2xl">
      <p className="eyebrow text-fg-muted">{en}</p>
      <h1 className="heading mt-3 type-display">{title}</h1>
      <p className="mt-4 txt-large text-fg-subtle">{blurb}</p>
    </div>
  );
}

function Filters({ layout, sort, price, inStock, set, current }: {
  layout: "sidebar" | "topbar" | "none"; sort: string; price: string; inStock: boolean; current: ShopCategory;
  set: (k: string, v: string | null) => void;
}) {
  const chip = (active: boolean) => cn("h-8 cursor-pointer rounded-control px-3 txt-small transition-colors", active ? "bg-primary text-on-primary" : "ring-1 ring-line-strong hover:bg-component");
  if (layout === "none") {
    return (
      <div className="flex justify-end gap-4 txt-small text-fg-muted">
        {SORTS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => set("sort", k === "featured" ? null : k)} className={cn("cursor-pointer hover:text-fg", sort === k && "text-fg underline underline-offset-4")}>{label}</button>
        ))}
      </div>
    );
  }
  if (layout === "sidebar") {
    return (
      <div className="flex flex-col gap-6 txt-small">
        <FilterGroup label="Category">
          {SHOP_CATEGORIES.map((c) => (
            <Link key={c} to={categoryPath(c)} className={cn("block py-0.5 hover:underline", c === current ? "font-semibold" : "text-fg-subtle")}>{CATEGORY_COPY[c].en}</Link>
          ))}
        </FilterGroup>
        <FilterGroup label="Sort">
          {SORTS.map(([k, label]) => (
            <button key={k} type="button" onClick={() => set("sort", k === "featured" ? null : k)} className={cn("block cursor-pointer py-0.5 text-left hover:underline", sort === k ? "font-semibold" : "text-fg-subtle")}>{label}</button>
          ))}
        </FilterGroup>
        <FilterGroup label="Price">
          {PRICES.map(([k, label]) => (
            <button key={k} type="button" onClick={() => set("price", k === "all" ? null : k)} className={cn("block cursor-pointer py-0.5 text-left hover:underline", price === k ? "font-semibold" : "text-fg-subtle")}>{label}</button>
          ))}
        </FilterGroup>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={inStock} onChange={(e) => set("stock", e.target.checked ? "1" : null)} className="accent-(--accent)" />
          只看有庫存
        </label>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRICES.map(([k, label]) => <button key={k} type="button" className={chip(price === k)} onClick={() => set("price", k === "all" ? null : k)}>{label}</button>)}
      <button type="button" className={chip(inStock)} onClick={() => set("stock", inStock ? null : "1")}>只看有庫存</button>
      <label className="ml-auto flex items-center gap-2 txt-small text-fg-muted">
        排序
        <select value={sort} onChange={(e) => set("sort", e.target.value === "featured" ? null : e.target.value)} className="h-8 rounded-control bg-component px-2 text-fg">
          {SORTS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </label>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 txt-xsmall uppercase tracking-wider text-fg-muted">{label}</p>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="py-16 text-center txt-medium text-fg-muted">這個條件下沒有商品。換個篩選試試。</p>;
}

export function NotFound() {
  return (
    <div className="page flex flex-col items-start gap-4 py-24">
      <p className="eyebrow text-fg-muted">404</p>
      <h1 className="heading type-h1">找不到這一頁</h1>
      <Link to="/" className="txt-medium underline underline-offset-4">回到首頁</Link>
    </div>
  );
}
