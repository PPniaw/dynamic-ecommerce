// How many products each kind of section / hero holds. Shared by the rule
// engine (fills to these) and sanitize (clamps Claude to these), so the two
// engines can't disagree about what a "bento" or a "flash" hero looks like.
// The numbers follow the web renderers: bento is a 7-tile mosaic, editorial a
// 5-item spread, dense a 2×5 price grid.
import type { Decision, RailLayout, Section } from "../../shared/decision.ts";

export const RAIL_COUNT: Record<RailLayout, number> = {
  table: 8, bento: 7, dense: 10, editorial: 5, grid: 8, carousel: 8,
};

export function sectionCount(s: Pick<Section, "kind" | "layout">): number {
  switch (s.kind) {
    case "rail": return RAIL_COUNT[s.layout];
    case "marquee": return 10;
    case "story": return 3;
    // Tiles, promo banner and ticker render from copy / the live catalog, not from a list.
    case "categories": case "promo": case "ticker": return 0;
  }
}

// Sections whose kind renders without products — never dropped for being empty.
export const holdsNoProducts = (s: Pick<Section, "kind">) => s.kind === "categories" || s.kind === "promo" || s.kind === "ticker";

export const HERO_COUNT: Record<Decision["hero"]["variant"], number> = {
  spread: 1, collage: 4, ledger: 0, flash: 3, minimal: 1,
};

export const MIN_SECTIONS = 3;
export const MAX_SECTIONS = 7;
