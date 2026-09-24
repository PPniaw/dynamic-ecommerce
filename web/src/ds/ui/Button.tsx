// Button recipe adapted from @medusajs/ui (MIT, © Medusa): cva variants,
// size scale, and a loading state that overlays a spinner so the button keeps
// its width. Colours are our role tokens instead of Medusa's.
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-control font-medium " +
    "transition-[background-color,color,box-shadow,transform,opacity] duration-150 active:scale-[0.98] " +
    "disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        primary: "bg-primary text-on-primary hover:bg-primary-hover",
        secondary: "bg-base text-fg ring-1 ring-inset ring-line-strong hover:bg-subtle",
        accent: "bg-accent text-on-accent hover:bg-accent-hover",
        ghost: "text-fg hover:bg-component",
        link: "h-auto! px-0! text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg",
      },
      size: {
        sm: "h-8 px-3 txt-small",
        md: "h-10 px-4 txt-medium",
        lg: "h-12 px-6 txt-large",
        icon: "h-10 w-10 p-0",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type Props = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { loading?: boolean };

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant, size, block, loading, disabled, children, ...rest }, ref,
) {
  return (
    <button ref={ref} className={cn(buttonVariants({ variant, size, block }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      <span className={cn("inline-flex items-center gap-2", loading && "invisible")}>{children}</span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center gap-1" aria-hidden>
          {/* LoadingDots, as in Vercel Commerce — with the keyframes it lost restored. */}
          {[0, 200, 400].map((d) => <span key={d} className="h-1 w-1 rounded-full bg-current animate-blink" style={{ animationDelay: `${d}ms` }} />)}
        </span>
      )}
    </button>
  );
});
