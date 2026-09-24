// The archetype card family. `standard` is the design-system ProductCard;
// the others are designed for one store each:
//   sticker — collage: tilted, thick outline, price in a bubble
//   deal    — deal: price first, discount block, stock bar
//   row     — index: a table row, specs in columns
import { Link, useNavigate } from "react-router";
import { productPath, type Product } from "../../../../shared/catalog";
import type { Decision } from "../../../../shared/decision";
import { Badge } from "../../ds/ui/Badge";
import { cn } from "../../ds/ui/cn";
import { Price, formatMoney } from "../../ds/ui/Price";
import { ProductCard, cardBadge, type Highlight } from "../../ds/ui/ProductCard";
import { ProductImage } from "../../ds/ui/ProductImage";
import { Stock, stockLevel } from "../../ds/ui/Stock";
import { CATEGORY_COPY } from "../copy";
import { useStore } from "../StoreContext";

export function useCardActions() {
  const navigate = useNavigate();
  const { add } = useStore();
  return {
    open: (p: Pick<Product, "id" | "name">) => navigate(productPath(p)),
    add: (p: Pick<Product, "id">) => add(p.id),
  };
}

const FLASH_MS = 1500;
export function useFlash() {
  const { changed } = useStore();
  const now = Date.now();
  return (id: string) => now - (changed.get(id) ?? 0) < FLASH_MS;
}

export function Card({ product, card, highlight, index = 0, eager }: {
  product: Product; card: Decision["card"]; highlight?: Highlight; index?: number; eager?: boolean;
}) {
  const a = useCardActions();
  if (card.variant === "sticker") return <StickerCard p={product} index={index} highlight={highlight} />;
  if (card.variant === "deal") return <DealCard p={product} highlight={highlight} />;
  return <ProductCard product={product} options={card} highlight={highlight} onOpen={a.open} onQuickAdd={card.quickAdd ? a.add : undefined} eager={eager} />;
}

// ---- sticker (collage) -------------------------------------------------------

const TILT = [-3, 2.5, -1.5, 3.5, -2.5, 1.5, -4, 2];

export function StickerCard({ p, index, highlight, big }: { p: Product; index: number; highlight?: Highlight; big?: boolean }) {
  const a = useCardActions();
  const badge = cardBadge(p, highlight);
  const soldOut = p.stock <= 0;
  return (
    <article
      className="group/card relative h-full transition-transform duration-300 ease-(--ease-bounce) [@media(hover:hover)]:hover:rotate-0! [@media(hover:hover)]:hover:-translate-y-1.5"
      style={{ rotate: `${TILT[index % TILT.length]}deg` }}
    >
      <div className="flex h-full flex-col overflow-hidden rounded-card bg-base ring-2 ring-fg shadow-[4px_4px_0_0_var(--fg)]">
        {/* Big bento tiles span grid rows: the photo fills whatever height the
            row gives it instead of forcing its own square (which stretched the grid). */}
        <button type="button" onClick={() => a.open(p)} className={cn("relative block w-full grow cursor-pointer", big && "min-h-64")} aria-label={p.name}>
          <ProductImage image={p.image} name={p.name} ratio="square" className={cn(big && "absolute inset-0 aspect-auto h-full", soldOut && "grayscale")} />
        </button>
        <div className="flex items-center justify-between gap-2 border-t-2 border-fg px-3 py-2.5">
          <button type="button" onClick={() => a.open(p)} className="min-w-0 cursor-pointer text-left">
            <p className={cn("heading truncate", big ? "type-h3" : "txt-large")}>{p.name}</p>
            <p className="truncate txt-xsmall text-fg-muted">{CATEGORY_COPY[p.category].label}</p>
          </button>
          {!soldOut && (
            <button type="button" onClick={() => a.add(p)} aria-label={`把 ${p.name} 加入購物車`}
              className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full bg-fg text-(--bg-base) transition-transform hover:scale-110 active:scale-95">
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v10M3 8h10" /></svg>
            </button>
          )}
        </div>
      </div>
      {/* price bubble, slightly off the card like a sticker on a sticker */}
      <span className="absolute -top-3 -right-2 rotate-6 rounded-full bg-accent px-3 py-1.5 txt-small font-bold text-on-accent tabular-nums shadow-[2px_2px_0_0_var(--fg)] ring-2 ring-fg">
        {formatMoney(p.price)}
      </span>
      {badge && <span className="absolute top-3 left-3"><Badge tone={badge.tone} look="solid" size="sm">{badge.label}</Badge></span>}
    </article>
  );
}

// ---- deal ------------------------------------------------------------------

export function DealCard({ p, highlight }: { p: Product; highlight?: Highlight }) {
  const a = useCardActions();
  const flash = useFlash();
  const off = p.compareAt ? Math.round((1 - p.price / p.compareAt) * 100) : 0;
  const level = stockLevel(p.stock);
  const soldPct = Math.round((p.sold / Math.max(1, p.sold + p.stock)) * 100);
  const badge = cardBadge(p, highlight, true);
  return (
    <article className={cn("card-hover group/card flex flex-col overflow-hidden rounded-card bg-base shadow-card ring-1 ring-line", flash(p.id) && "animate-[flash-down_900ms]")}>
      <button type="button" onClick={() => a.open(p)} className="relative block cursor-pointer" aria-label={p.name}>
        <ProductImage image={p.image} name={p.name} ratio="square" width={400} className={cn(level === "out" && "grayscale")} />
        {off > 0 && (
          <span className="absolute top-0 left-0 bg-accent px-2.5 py-1.5 text-[22px] leading-none font-black tracking-tight text-on-accent tabular-nums">-{off}%</span>
        )}
        {off === 0 && badge && <span className="absolute top-2 left-2"><Badge tone={badge.tone} look="solid" size="xs">{badge.label}</Badge></span>}
      </button>
      <div className="flex grow flex-col gap-2 p-(--card-pad)">
        <button type="button" onClick={() => a.open(p)} className="line-clamp-1 cursor-pointer text-left txt-small text-fg-subtle hover:text-fg">{p.name}</button>
        <Price amount={p.price} compareAt={p.compareAt} size="lg" showDiscount={false} />
        {/* stock bar: how much of the run is gone */}
        <div className="flex flex-col gap-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-component">
            <div className={cn("h-full rounded-full transition-[width] duration-700", level === "low" ? "bg-warning" : "bg-accent")} style={{ width: `${level === "out" ? 100 : soldPct}%` }} />
          </div>
          <div className="flex justify-between txt-xsmall text-fg-muted tabular-nums">
            <span>已售 {p.sold}</span>
            <Stock stock={p.stock} showOk />
          </div>
        </div>
        <button type="button" disabled={level === "out"} onClick={() => a.add(p)}
          className="mt-auto h-9 cursor-pointer rounded-control bg-primary txt-small font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40">
          {level === "out" ? "已售完" : "加入購物車"}
        </button>
      </div>
    </article>
  );
}

// ---- row (index) -----------------------------------------------------------

export function ProductRow({ p, n }: { p: Product; n: number }) {
  const a = useCardActions();
  const flash = useFlash();
  const soldOut = p.stock <= 0;
  return (
    <tr className={cn("group/row border-b border-line align-middle transition-colors hover:bg-subtle", flash(p.id) && "animate-[flash-down_900ms]")}>
      <td className="py-2 pr-3 txt-xsmall text-fg-muted tabular-nums">{String(n).padStart(2, "0")}</td>
      <td className="py-2 pr-3">
        <Link to={productPath(p)} className="flex items-center gap-3">
          <span className="w-11 shrink-0 overflow-hidden rounded-media"><ProductImage image={p.image} name="" ratio="square" width={120} quietFallback /></span>
          <span className="min-w-0">
            <span className="block truncate txt-small font-medium group-hover/row:underline group-hover/row:underline-offset-4">{p.name}</span>
            <span className="block truncate txt-xsmall text-fg-muted sm:hidden">{p.maker}</span>
          </span>
        </Link>
      </td>
      <td className="hidden py-2 pr-3 txt-xsmall text-fg-subtle sm:table-cell">{p.maker}</td>
      <td className="hidden py-2 pr-3 txt-xsmall text-fg-subtle md:table-cell">{CATEGORY_COPY[p.category].en}</td>
      <td className="py-2 pr-3 text-right"><Price amount={p.price} compareAt={p.compareAt} size="sm" showDiscount /></td>
      <td className="hidden py-2 pr-3 text-right txt-xsmall tabular-nums lg:table-cell">
        <span className={cn(p.stock <= 5 && p.stock > 0 && "text-warning", soldOut && "text-fg-muted")}>{soldOut ? "—" : p.stock}</span>
      </td>
      <td className="py-2 text-right">
        <button type="button" disabled={soldOut} onClick={() => a.add(p)} aria-label={`把 ${p.name} 加入購物車`}
          className="h-7 cursor-pointer whitespace-nowrap rounded-control px-2.5 txt-xsmall font-medium ring-1 ring-line-strong transition-colors hover:bg-primary hover:text-on-primary hover:ring-primary disabled:cursor-not-allowed disabled:opacity-40">
          {soldOut ? "售完" : "+ 加入"}
        </button>
      </td>
    </tr>
  );
}
