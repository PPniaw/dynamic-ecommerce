import { cn } from "../ds/ui/cn";

export function Segmented<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: readonly (T | { value: T; label: string })[];
  onChange: (v: T) => void;
}) {
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <div className="flex flex-col gap-1.5">
      <span className="txt-xsmall font-medium text-fg-muted">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
        {opts.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-7 rounded-control px-2.5 txt-xsmall transition-colors",
              o.value === value ? "bg-primary text-on-primary" : "bg-component text-fg-subtle hover:text-fg",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)} className="flex items-center justify-between gap-3 txt-small">
      <span>{label}</span>
      <span className={cn("relative h-5 w-9 rounded-full transition-colors", value ? "bg-accent" : "bg-line-strong")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-base shadow transition-all", value ? "left-4.5" : "left-0.5")} />
      </span>
    </button>
  );
}
