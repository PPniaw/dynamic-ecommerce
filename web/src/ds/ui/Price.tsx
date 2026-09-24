// Price with live-update feedback.
//
// Layout follows Horizon: sale price first, compare-at subdued with a thin
// struck line; Medusa's "-N%" in the accent colour. What's ours: when the
// amount changes on the server, the figure flashes green (down) or red (up)
// so a shopper *sees* the market move instead of noticing a number is different.
import { useEffect, useRef, useState } from "react";
import { cn } from "./cn";

// zh-TW renders TWD as a bare "$"; spell out NT$ so it can't be read as USD.
const fmt = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 });
export const formatMoney = (n: number) => `NT$${fmt.format(n)}`;

export function Price({ amount, compareAt, size = "md", showDiscount = true, pending, className }: {
  amount: number;
  compareAt?: number;
  size?: "sm" | "md" | "lg" | "xl";
  showDiscount?: boolean;
  // Totals being recomputed: shimmer instead of a spinner (Horizon).
  pending?: boolean;
  className?: string;
}) {
  const prev = useRef(amount);
  const [move, setMove] = useState<{ dir: "down" | "up"; n: number } | null>(null);
  useEffect(() => {
    if (amount !== prev.current) {
      setMove((m) => ({ dir: amount < prev.current ? "down" : "up", n: (m?.n ?? 0) + 1 }));
      prev.current = amount;
    }
  }, [amount]);

  const onSale = compareAt !== undefined && compareAt > amount;
  const pct = onSale ? Math.round((1 - amount / compareAt!) * 100) : 0;
  const sizeCls = { sm: "txt-small", md: "txt-medium", lg: "txt-xlarge", xl: "text-[28px] leading-9" }[size];

  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5 tabular-nums", sizeCls, className)}>
      <span
        // key restarts the animation on every move, even two drops in a row.
        key={move?.n ?? 0}
        className={cn(
          "-mx-1 rounded-[3px] px-1 font-semibold",
          onSale && "text-accent",
          move?.dir === "down" && "animate-flash-down",
          move?.dir === "up" && "animate-flash-up",
          pending && "shimmer",
        )}
      >
        {formatMoney(amount)}
      </span>
      {onSale && (
        <s className="text-[0.86em] text-fg-muted decoration-[1.5px] decoration-[color-mix(in_oklab,var(--fg)_35%,transparent)]">
          {formatMoney(compareAt!)}
        </s>
      )}
      {onSale && showDiscount && <span className="text-[0.86em] font-medium text-accent">-{pct}%</span>}
    </span>
  );
}
