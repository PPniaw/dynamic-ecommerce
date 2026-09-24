import { cn } from "./cn";

// One skeleton style for the whole store (Medusa mixes three greys; we don't).
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-control bg-component", className)} />;
}
