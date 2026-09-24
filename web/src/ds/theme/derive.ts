// Seeds + surface → the full set of role variables.
//
// A section picks a *surface* (page / subtle / inverse / accent), never a
// colour. Text, borders, buttons and hover states are recomputed for that
// surface so contrast holds everywhere — the LLM can't produce unreadable text.
import { bestOn, contrast, ensureContrast, hoverShift, mix } from "./color";
import { PALETTES, type PaletteName, type Seeds } from "./palettes";

export type Scheme = "light" | "dark";
export type Surface = "page" | "subtle" | "inverse" | "accent";

// Fixed semantic tones (not LLM-controlled): stock, price moves, errors.
const TONES = {
  light: { success: "#15803D", warning: "#C2410C", danger: "#BE123C" },
  dark: { success: "#4ADE80", warning: "#FB923C", danger: "#FB7185" },
};

function seedsFor(palette: PaletteName, scheme: Scheme, surface: Surface): { s: Seeds; tones: Scheme } {
  const p = PALETTES[palette];
  const own = p[scheme];
  const other = scheme === "light" ? "dark" : "light";
  switch (surface) {
    case "page":
      return { s: own, tones: scheme };
    case "subtle":
      return { s: { ...own, bg: own.soft, soft: mix(own.fg, own.soft, 0.05), line: mix(own.fg, own.soft, 0.12) }, tones: scheme };
    case "inverse":
      // Inverse = the same palette's opposite scheme. Its accent was tuned
      // for that background, so it stays legible without extra maths.
      return { s: p[other], tones: other };
    case "accent": {
      // Candidates include the light palette's ink: a dark scheme's accent is
      // usually light, and white text on it would fail.
      const on = ensureContrast(bestOn(own.accent, ["#FFFFFF", p.light.fg, p.dark.fg]), own.accent, 4.5);
      return {
        s: { bg: own.accent, soft: mix(on, own.accent, 0.1), fg: on, accent: on, line: mix(on, own.accent, 0.25) },
        tones: bestOn(own.accent, ["#FFFFFF", "#000000"]) === "#FFFFFF" ? "dark" : "light",
      };
    }
  }
}

// Text roles must pass WCAG AA (4.5) on their surface; the accent used as
// text or as a thin UI mark must pass 3.
const AA = 4.6; // a hair above 4.5 so rounding never lands on the line

export function deriveVars(palette: PaletteName, scheme: Scheme, surface: Surface): Record<string, string> {
  const { s, tones } = seedsFor(palette, scheme, surface);
  const text = (c: string) => ensureContrast(c, s.bg, AA, s.fg);
  // Buttons: keep the palette's accent where possible, darken/lighten it just
  // enough for its label to pass.
  let accent = ensureContrast(s.accent, s.bg, 3);
  const onAccent = bestOn(accent, ["#FFFFFF", s.bg, s.fg, "#111111"]);
  if (contrast(onAccent, accent) < AA) accent = ensureContrast(accent, onAccent, AA);
  // Semantic tones: start from whichever scheme's tone suits this surface,
  // then guard it like any other text.
  const tone = (k: "success" | "warning" | "danger") =>
    text(bestOn(s.bg, [TONES[tones][k], TONES.light[k], TONES.dark[k]]));
  return {
    "--bg-base": s.bg,
    "--bg-subtle": s.soft,
    "--bg-component": mix(s.fg, s.bg, 0.06),
    "--fg": text(s.fg),
    "--fg-subtle": text(mix(s.fg, s.bg, 0.78)),
    "--fg-muted": text(mix(s.fg, s.bg, 0.6)),
    "--line": s.line,
    "--line-strong": mix(s.fg, s.bg, 0.24),
    "--accent": accent,
    "--accent-hover": hoverShift(accent),
    "--on-accent": onAccent,
    // Primary button is ink-on-paper (Horizon's default), accent stays for
    // sale / emphasis so it keeps meaning something.
    "--primary": text(s.fg),
    "--primary-hover": hoverShift(text(s.fg)),
    "--on-primary": s.bg,
    "--success": tone("success"),
    "--warning": tone("warning"),
    "--danger": tone("danger"),
  };
}

export const COLOR_VARS = Object.keys(deriveVars("ink", "light", "page"));
