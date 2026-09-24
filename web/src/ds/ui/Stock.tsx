// Stock line (Horizon's inventory block): green dot when plenty, orange
// "只剩 N 件" under the threshold, grey when gone. The threshold lives here,
// not in the LLM's hands — "low stock" has to be true.
import { cn } from "./cn";

export const LOW_STOCK = 5;

export function stockLevel(stock: number): "out" | "low" | "ok" {
  return stock <= 0 ? "out" : stock <= LOW_STOCK ? "low" : "ok";
}

export function Stock({ stock, showOk = false, className }: { stock: number; showOk?: boolean; className?: string }) {
  const level = stockLevel(stock);
  if (level === "ok" && !showOk) return null;
  const [dot, text] = {
    out: ["bg-fg-muted", "已售完"],
    low: ["bg-warning", `只剩 ${stock} 件`],
    ok: ["bg-success", "現貨供應"],
  }[level];
  return (
    <span className={cn("inline-flex items-center gap-1.5 txt-xsmall", level === "low" ? "text-warning" : "text-fg-muted", className)}>
      {/* key: the dot pops once whenever the level changes */}
      <span key={level} className={cn("h-1.5 w-1.5 rounded-full animate-pulse-once", dot)} />
      <span key={stock} className="animate-fade-in">{text}</span>
    </span>
  );
}
