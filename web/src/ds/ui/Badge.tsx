// Badge = tone × style × size. Tone colours are the fixed semantic ones plus
// the palette accent; `glass` is Vercel Commerce's frosted label, for sitting
// on top of photos.
import { cva, type VariantProps } from "class-variance-authority";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "./cn";

const TONE_VAR = {
  neutral: "var(--fg)",
  accent: "var(--accent)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
} as const;

export const badgeVariants = cva("inline-flex items-center gap-1 whitespace-nowrap rounded-badge font-medium leading-none", {
  variants: {
    look: {
      soft: "bg-[color-mix(in_oklab,var(--tone)_13%,var(--bg-base))] text-[color-mix(in_oklab,var(--tone)_82%,var(--fg))]",
      solid: "bg-(--tone) text-(--tone-on)",
      outline: "ring-1 ring-inset ring-[color-mix(in_oklab,var(--tone)_45%,transparent)] text-[color-mix(in_oklab,var(--tone)_85%,var(--fg))]",
      glass: "bg-base/75 text-fg ring-1 ring-inset ring-line backdrop-blur-md",
    },
    size: {
      xs: "h-5 px-1.5 text-[11px]",
      sm: "h-6 px-2 txt-xsmall",
      md: "h-7 px-2.5 txt-small",
    },
  },
  defaultVariants: { look: "soft", size: "sm" },
});

export type BadgeTone = keyof typeof TONE_VAR;

export function Badge({ tone = "neutral", look, size, className, children }: VariantProps<typeof badgeVariants> & {
  tone?: BadgeTone; className?: string; children: ReactNode;
}) {
  // Solid neutral is ink-on-paper; other solid tones carry white text.
  const style = { "--tone": TONE_VAR[tone], "--tone-on": tone === "neutral" ? "var(--bg-base)" : "#fff" } as CSSProperties;
  return <span className={cn(badgeVariants({ look, size }), className)} style={style}>{children}</span>;
}
