// Four headers, one per store personality.
//   centered — editorial: wordmark in the middle, quiet text links
//   bubbly   — collage: blob logo, pill category chips, bouncy cart
//   bar      — index: one thin uppercase bar with an inline search
//   utility  — deal: countdown strip, big search, cart shows the running total
import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router";
import { SHOP_CATEGORIES, categoryPath } from "../../../../shared/catalog";
import type { Decision } from "../../../../shared/decision";
import { Surface } from "../../ds/theme/ThemeScope";
import { cn } from "../../ds/ui/cn";
import { formatMoney } from "../../ds/ui/Price";
import { ANNOUNCEMENT_COPY, CATEGORY_COPY, STORE_NAME, STORE_NAME_EN } from "../copy";
import { useStore } from "../StoreContext";

function useCartSummary() {
  const { cart, products, setCartOpen } = useStore();
  const count = cart.reduce((s, l) => s + l.qty, 0);
  const total = cart.reduce((s, l) => s + (products.get(l.productId)?.price ?? 0) * l.qty, 0);
  return { count, total, open: () => setCartOpen(true) };
}

// Minutes:seconds to the top of the hour — the flash sale "resets" hourly.
export function useCountdown() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const left = 3600 - Math.floor((now / 1000) % 3600);
  return `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
}

function Announcement({ kind, className }: { kind: Decision["header"]["announcement"]; className?: string }) {
  const text = ANNOUNCEMENT_COPY[kind];
  if (!text) return null;
  return <div className={cn("px-4 py-2 text-center txt-xsmall", className)}>{text}</div>;
}

export function Header({ header }: { header: Decision["header"] }) {
  switch (header.variant) {
    case "bubbly": return <Bubbly announcement={header.announcement} />;
    case "bar": return <Bar announcement={header.announcement} />;
    case "utility": return <Utility announcement={header.announcement} />;
    default: return <Centered announcement={header.announcement} />;
  }
}

function Centered({ announcement }: { announcement: Decision["header"]["announcement"] }) {
  const cart = useCartSummary();
  return (
    <header className="sticky top-0 z-30 bg-base/90 backdrop-blur-md">
      <Announcement kind={announcement} className="border-b border-line eyebrow text-fg-subtle" />
      <div className="page grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-5">
        <nav className="hidden items-center gap-6 txt-small text-fg-subtle lg:flex">
          {SHOP_CATEGORIES.slice(0, 4).map((c) => (
            <NavLink key={c} to={categoryPath(c)} className={({ isActive }) => cn("hover:text-fg", isActive && "text-fg underline underline-offset-8")}>{CATEGORY_COPY[c].label}</NavLink>
          ))}
        </nav>
        <Link to="/" className="col-start-2 text-center">
          <span className="heading block type-h2 leading-none">{STORE_NAME}</span>
          <span className="eyebrow mt-1 block text-fg-muted">{STORE_NAME_EN}</span>
        </Link>
        <div className="flex justify-end">
          <button type="button" onClick={cart.open} className="cursor-pointer txt-small hover:underline hover:underline-offset-4">
            購物袋 <span className="tabular-nums">({cart.count})</span>
          </button>
        </div>
      </div>
      <div className="border-b border-line" />
    </header>
  );
}

function Bubbly({ announcement }: { announcement: Decision["header"]["announcement"] }) {
  const cart = useCartSummary();
  return (
    <header className="sticky top-0 z-30 bg-base/85 backdrop-blur-md">
      <Announcement kind={announcement} className="bg-accent font-semibold text-on-accent" />
      <div className="page flex items-center gap-4 py-3">
        <Link to="/" className="shrink-0 -rotate-3 rounded-[40%_60%_55%_45%/55%_45%_60%_40%] bg-fg px-4 py-2 transition-transform hover:rotate-3">
          <span className="heading txt-xlarge text-(--bg-base)">{STORE_NAME}!</span>
        </Link>
        <nav className="flex min-w-0 grow gap-2 overflow-x-auto py-1 [scrollbar-width:none]">
          {SHOP_CATEGORIES.map((c, i) => (
            <NavLink key={c} to={categoryPath(c)}
              className={({ isActive }) => cn(
                "shrink-0 rounded-full px-3.5 py-1.5 txt-small font-medium ring-2 ring-fg transition-transform hover:-translate-y-0.5",
                isActive ? "bg-fg text-(--bg-base)" : i % 3 === 0 ? "bg-subtle" : "bg-base",
              )}>
              {CATEGORY_COPY[c].label}
            </NavLink>
          ))}
        </nav>
        <button type="button" onClick={cart.open} aria-label={`購物車,${cart.count} 件`}
          className="relative grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full bg-accent text-on-accent ring-2 ring-fg transition-transform hover:scale-110">
          <BagIcon />
          {cart.count > 0 && <span key={cart.count} className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 animate-pulse-once place-items-center rounded-full bg-fg px-1 text-[11px] font-bold text-(--bg-base)">{cart.count}</span>}
        </button>
      </div>
    </header>
  );
}

function Bar({ announcement }: { announcement: Decision["header"]["announcement"] }) {
  const cart = useCartSummary();
  return (
    <header className="sticky top-0 z-30 border-b border-fg bg-base">
      <Announcement kind={announcement} className="border-b border-line uppercase" />
      <div className="page flex h-12 items-center gap-6 txt-xsmall uppercase tracking-wider">
        <Link to="/" className="font-semibold">{STORE_NAME_EN} / {STORE_NAME}</Link>
        <nav className="hidden gap-4 text-fg-subtle md:flex">
          {SHOP_CATEGORIES.map((c) => (
            <NavLink key={c} to={categoryPath(c)} className={({ isActive }) => cn("hover:text-fg", isActive && "text-fg")}>{CATEGORY_COPY[c].en}</NavLink>
          ))}
        </nav>
        <button type="button" onClick={cart.open} className="ml-auto cursor-pointer tabular-nums hover:underline">Cart [{String(cart.count).padStart(2, "0")}]</button>
      </div>
    </header>
  );
}

function Utility({ announcement }: { announcement: Decision["header"]["announcement"] }) {
  const cart = useCartSummary();
  const t = useCountdown();
  const text = ANNOUNCEMENT_COPY[announcement];
  return (
    <header className="sticky top-0 z-30 bg-base shadow-[0_1px_0_var(--line)]">
      {text && (
        <div className="flex items-center justify-center gap-3 bg-accent px-4 py-1.5 txt-small font-semibold text-on-accent">
          <span>{text}</span>
          <span className="rounded-badge bg-fg/15 px-2 font-mono tabular-nums">{t}</span>
        </div>
      )}
      <div className="page flex items-center gap-4 py-3">
        <Link to="/" className="heading shrink-0 txt-xlarge">{STORE_NAME}</Link>
        <div className="flex h-10 grow items-center gap-2 rounded-control bg-component px-3 txt-small text-fg-muted">
          <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" /></svg>
          <span className="truncate">搜尋商品、品牌、分類</span>
        </div>
        <button type="button" onClick={cart.open}
          className="flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-control bg-primary px-3 txt-small font-semibold text-on-primary hover:bg-primary-hover">
          <BagIcon />
          <span className="tabular-nums">{cart.count > 0 ? formatMoney(cart.total) : "購物車"}</span>
        </button>
      </div>
      <nav className="page flex gap-5 overflow-x-auto pb-2 txt-small text-fg-subtle [scrollbar-width:none]">
        {SHOP_CATEGORIES.map((c) => (
          <NavLink key={c} to={categoryPath(c)} className={({ isActive }) => cn("shrink-0 border-b-2 border-transparent pb-1 hover:text-fg", isActive && "border-accent text-fg")}>{CATEGORY_COPY[c].label}</NavLink>
        ))}
      </nav>
    </header>
  );
}

function BagIcon() {
  return <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 7h12l-1 10H5L4 7Z" /><path d="M7.5 7V5.5a2.5 2.5 0 0 1 5 0V7" /></svg>;
}

export function Footer({ archetype }: { archetype: Decision["archetype"] }) {
  return (
    <Surface surface="inverse" as="div" className="mt-(--section-gap)">
      <footer className="page flex flex-col gap-10 py-14">
        {archetype === "editorial" || archetype === "collage" ? (
          <p className={cn("heading leading-none", archetype === "collage" ? "text-[18vw] -rotate-2" : "text-[14vw] tracking-tight")}>{STORE_NAME}</p>
        ) : (
          <p className="heading txt-xlarge uppercase">{STORE_NAME_EN} / {STORE_NAME}</p>
        )}
        <div className="grid grid-cols-2 gap-6 txt-small text-fg-subtle md:grid-cols-4">
          {SHOP_CATEGORIES.map((c) => <Link key={c} to={categoryPath(c)} className="hover:underline">{CATEGORY_COPY[c].label}</Link>)}
        </div>
        <p className="txt-xsmall text-fg-muted">這是一個 demo:版面由 LLM 依你的個性與行為即時決定。付款為模擬。</p>
      </footer>
    </Surface>
  );
}
