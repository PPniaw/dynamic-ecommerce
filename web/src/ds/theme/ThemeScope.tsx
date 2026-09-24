// Applies a theme decision to a subtree. Colours go in as inline CSS
// variables (registered with @property in tokens.css, so they *animate* when
// the LLM switches palette); everything else is a data attribute that
// tokens.css maps to shape / density / type variables.
//
// Nesting works: <Surface> inside a <ThemeScope> recomputes colours for that
// section only.
import { createContext, useContext, useMemo, type CSSProperties, type ReactNode } from "react";
import { deriveVars, type Scheme, type Surface as SurfaceName } from "./derive";
import type { PaletteName } from "./palettes";

export interface ThemeOptions {
  palette: PaletteName;
  scheme: Scheme;
  fonts: "modern" | "editorial" | "friendly" | "literary";
  typeScale: "compact" | "normal" | "display";
  headingCase: "none" | "uppercase";
  radius: "sharp" | "soft" | "round" | "pill";
  density: "tight" | "normal" | "airy";
  pageWidth: "narrow" | "normal" | "wide";
  hoverEffect: "none" | "lift" | "scale" | "zoom";
  elevation: "flat" | "soft";
}

export const DEFAULT_THEME: ThemeOptions = {
  palette: "sand", scheme: "light", fonts: "editorial", typeScale: "normal", headingCase: "none",
  radius: "soft", density: "normal", pageWidth: "normal", hoverEffect: "zoom", elevation: "flat",
};

const Ctx = createContext<ThemeOptions>(DEFAULT_THEME);
export const useTheme = () => useContext(Ctx);

export function ThemeScope({ theme, children, className }: { theme: ThemeOptions; children: ReactNode; className?: string }) {
  const style = useMemo(() => deriveVars(theme.palette, theme.scheme, "page") as CSSProperties, [theme.palette, theme.scheme]);
  return (
    <Ctx.Provider value={theme}>
      <div
        className={`theme-root bg-base text-fg font-sans ${className ?? ""}`}
        style={style}
        data-scheme={theme.scheme}
        data-fonts={theme.fonts}
        data-type={theme.typeScale}
        data-heading-case={theme.headingCase}
        data-radius={theme.radius}
        data-density={theme.density}
        data-width={theme.pageWidth}
        data-hover={theme.hoverEffect}
        data-elevation={theme.elevation}
      >
        {children}
      </div>
    </Ctx.Provider>
  );
}

export function Surface({ surface, children, className, as: As = "section" }: {
  surface: SurfaceName; children: ReactNode; className?: string; as?: "section" | "div";
}) {
  const t = useTheme();
  const style = useMemo(() => deriveVars(t.palette, t.scheme, surface) as CSSProperties, [t.palette, t.scheme, surface]);
  return <As className={`surface bg-base text-fg ${className ?? ""}`} style={style} data-surface={surface}>{children}</As>;
}
