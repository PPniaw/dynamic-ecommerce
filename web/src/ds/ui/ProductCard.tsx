// The product card — the component the LLM's choices touch most.
//
//   ProductCard
//   ├─ Media   imageRatio · hover · badge · quick add
//   └─ Info    stacked | row | overlay
//
// Sources: Horizon for the option axes, badge rules and quick-add behaviour
// (patterns only); Vercel Commerce (MIT) for the glass price label used by
// `overlay` and the tile hover; Medusa (MIT) for the `row` info layout and the
// `card` frame's elevation.
import { useState, type CSSProperties } from "react";
import type { CatalogProduct, ImageRatio } from "../../../../shared/catalog";
import { Badge, type BadgeTone } from "./Badge";
import { cn } from "./cn";
import { Price } from "./Price";
import { ProductImage, type ImageStatus } from "./ProductImage";
import { Stock, stockLevel } from "./Stock";

export interface CardOptions {
  imageRatio: ImageRatio;
  hover: "none" | "second_image" | "zoom";
  quickAdd: boolean;
  info: "stacked" | "row" | "overlay";
  badgePosition: "top-left" | "top-right" | "bottom-left";
  frame: "bare" | "card";
}

export const DEFAULT_CARD: CardOptions = {
  imageRatio: "portrait", hover: "second_image", quickAdd: true, info: "stacked", badgePosition: "top-left", frame: "bare",
};

// The only badge the LLM can add is a recommendation. Truth-bearing badges
// (sold out, sale, low stock) are computed, and outrank it.
export type Highlight = "for_you" | "trending" | "new";

interface BadgeSpec { label: string; tone: BadgeTone; look: "solid" | "soft" | "glass" }

// `stockShown`: the card already prints "只剩 N 件" under the price, so a
// "少量" badge would say the same thing twice.
export function cardBadge(p: CatalogProduct, highlight?: Highlight, stockShown = false): BadgeSpec | null {
  const level = stockLevel(p.stock);
  if (level === "out") return { label: "售完", tone: "neutral", look: "glass" };
  if (p.compareAt && p.compareAt > p.price) return { label: `-${Math.round((1 - p.price / p.compareAt) * 100)}%`, tone: "accent", look: "solid" };
  if (level === "low" && !stockShown) return { label: "少量", tone: "warning", look: "soft" };
  if (highlight === "for_you") return { label: "為你挑選", tone: "accent", look: "soft" };
  if (highlight === "trending") return { label: "熱賣", tone: "danger", look: "soft" };
  if (highlight === "new" || p.isNew) return { label: "新品", tone: "neutral", look: "glass" };
  return null;
}

// Badges keep clear of rounded corners: inset grows with the radius
// ((r + pad)·(1 − cos 45°), the same idea as Horizon).
const BADGE_POS: Record<CardOptions["badgePosition"], CSSProperties> = {
  "top-left": { top: "var(--badge-inset)", left: "var(--badge-inset)" },
  "top-right": { top: "var(--badge-inset)", right: "var(--badge-inset)" },
  "bottom-left": { bottom: "var(--badge-inset)", left: "var(--badge-inset)" },
};

export function ProductCard({ product: p, options: o, highlight, onOpen, onQuickAdd, eager, onImageStatus }: {
  product: CatalogProduct;
  options: CardOptions;
  highlight?: Highlight;
  onOpen?: (p: CatalogProduct) => void;
  onQuickAdd?: (p: CatalogProduct) => Promise<void> | void;
  eager?: boolean;
  onImageStatus?: (s: ImageStatus) => void;
}) {
  const badge = cardBadge(p, highlight, o.info !== "overlay");
  const soldOut = p.stock <= 0;
  const inCard = o.frame === "card";
  // `overlay` already puts the price on the photo; don't stack a badge on top of it at the bottom.
  const badgePos = o.info === "overlay" && o.badgePosition === "bottom-left" ? "top-left" : o.badgePosition;

  return (
    <article
      className={cn(
        "group/card card-hover relative flex flex-col",
        inCard && "rounded-card bg-base p-(--card-pad) shadow-card ring-1 ring-line",
        soldOut && "opacity-75",
      )}
      style={{ "--badge-inset": `calc(10px + var(--r-media) * 0.2929)` } as CSSProperties}
    >
      <div className={cn("relative overflow-hidden", inCard ? "rounded-media" : "rounded-card")}>
        <button type="button" onClick={() => onOpen?.(p)} className="block w-full cursor-pointer text-left" aria-label={p.name}>
          <ProductImage
            image={p.image}
            name={p.name}
            ratio={o.imageRatio}
            secondary={o.hover === "second_image"}
            eager={eager}
            onStatus={onImageStatus}
            quietFallback={o.info === "overlay"}
            className={cn(soldOut && "grayscale-[60%]")}
          />
        </button>

        {badge && (
          <span className="pointer-events-none absolute z-10" style={BADGE_POS[badgePos]}>
            <Badge tone={badge.tone} look={badge.look} size="sm">{badge.label}</Badge>
          </span>
        )}

        {o.quickAdd && !soldOut && onQuickAdd && <QuickAdd onAdd={() => onQuickAdd(p)} lifted={o.info === "overlay"} />}

        {o.info === "overlay" && <OverlayLabel p={p} />}
      </div>

      {o.info !== "overlay" && (
        <div className={cn("flex pt-3", o.info === "row" ? "items-start justify-between gap-3" : "flex-col gap-1")}>
          <div className="min-w-0">
            <p className={cn("truncate txt-xsmall text-fg-muted", o.info === "row" && "hidden")}>{p.maker}</p>
            <h3 className={cn("line-clamp-2 txt-medium", o.info === "row" ? "text-fg-subtle" : "text-fg")}>
              <button type="button" onClick={() => onOpen?.(p)} className="cursor-pointer text-left hover:underline hover:underline-offset-4">{p.name}</button>
            </h3>
          </div>
          <div className={cn("flex flex-col gap-1", o.info === "row" && "shrink-0 items-end")}>
            <Price amount={p.price} compareAt={p.compareAt} size="sm" showDiscount={false} />
            <Stock stock={p.stock} />
          </div>
        </div>
      )}
    </article>
  );
}

// Vercel Commerce's frosted price label (MIT), with our tokens: the pill takes
// the theme's control radius, the price chip is the accent.
function OverlayLabel({ p }: { p: CatalogProduct }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex p-3 @container/label">
      <div className="flex w-full items-center gap-2 rounded-control bg-base/75 p-1 pl-3 ring-1 ring-line backdrop-blur-md">
        <span className="line-clamp-1 grow txt-small font-medium">{p.name}</span>
        <span className="flex-none rounded-control bg-accent px-2.5 py-1 txt-small font-semibold text-on-accent tabular-nums">
          NT${p.price.toLocaleString("zh-TW")}
        </span>
      </div>
    </div>
  );
}

// Round quick-add button in the photo's corner (Horizon's behaviour, our
// code): fades in on card hover, widens to show its label when pointed at;
// always visible on touch screens where there is no hover.
function QuickAdd({ onAdd, lifted }: { onAdd: () => Promise<void> | void; lifted: boolean }) {
  const [state, setState] = useState<"idle" | "adding" | "added">("idle");
  const click = async () => {
    if (state !== "idle") return;
    setState("adding");
    await onAdd();
    setState("added");
    setTimeout(() => setState("idle"), 1400);
  };
  return (
    <button
      type="button"
      onClick={click}
      aria-label="加入購物車"
      className={cn(
        "group/qa absolute right-3 z-10 flex h-9 min-w-9 items-center justify-center overflow-hidden rounded-control bg-base/90 px-2.5 text-fg shadow-flyout backdrop-blur",
        "transition-all duration-200 ease-(--ease-out-soft) hover:bg-primary hover:text-on-primary",
        "[@media(hover:hover)]:translate-y-1 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/card:translate-y-0 [@media(hover:hover)]:group-hover/card:opacity-100",
        "focus-visible:translate-y-0 focus-visible:opacity-100",
        state !== "idle" && "translate-y-0! opacity-100!",
        lifted ? "bottom-[64px]" : "bottom-3",
      )}
    >
      {state === "added" ? (
        <svg viewBox="0 0 16 16" className="h-4 w-4 animate-pulse-once" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8.5 6.5 12 13 4.5" /></svg>
      ) : state === "adding" ? (
        <span className="flex gap-0.5">{[0, 200, 400].map((d) => <span key={d} className="h-1 w-1 rounded-full bg-current animate-blink" style={{ animationDelay: `${d}ms` }} />)}</span>
      ) : (
        <>
          <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M8 3v10M3 8h10" /></svg>
          <span className="max-w-0 whitespace-nowrap txt-small font-medium transition-all duration-200 group-hover/qa:ml-1.5 group-hover/qa:max-w-16">加入</span>
        </>
      )}
    </button>
  );
}

// Skeleton twin: same frame, same aspect, same info rows — nothing shifts
// when the real card arrives (Medusa's rule, minus its 9/16 vs 11/14 bug).
export function ProductCardSkeleton({ options: o }: { options: CardOptions }) {
  const aspect = { portrait: "aspect-[4/5]", square: "aspect-square", landscape: "aspect-video" }[o.imageRatio];
  const inCard = o.frame === "card";
  return (
    <div aria-hidden className={cn("flex flex-col", inCard && "rounded-card bg-base p-(--card-pad) ring-1 ring-line")}>
      <div className={cn("animate-pulse bg-component", aspect, inCard ? "rounded-media" : "rounded-card")} />
      {o.info !== "overlay" && (
        <div className={cn("flex pt-3", o.info === "row" ? "justify-between gap-3" : "flex-col gap-2")}>
          <div className="flex flex-col gap-1.5">
            {o.info !== "row" && <div className="h-3 w-16 animate-pulse rounded-badge bg-component" />}
            <div className="h-4 w-32 animate-pulse rounded-badge bg-component" />
          </div>
          <div className="h-4 w-14 animate-pulse rounded-badge bg-component" />
        </div>
      )}
    </div>
  );
}
