// Six palettes for a lifestyle select shop. Each has a light and a dark set of
// five seeds; everything else is derived (see derive.ts).
//
// Seeds: bg (page), soft (subtle panels), fg (ink), accent (the one voice of
// colour: sale, links, highlights), line (hairlines).

export interface Seeds { bg: string; soft: string; fg: string; accent: string; line: string }
export interface Palette { label: string; light: Seeds; dark: Seeds }

export const PALETTES = {
  ink: {
    label: "墨 · 黑白灰",
    light: { bg: "#FAFAF9", soft: "#F1F0EE", fg: "#1C1917", accent: "#1D4ED8", line: "#E7E5E4" },
    dark: { bg: "#0C0A09", soft: "#1C1917", fg: "#FAFAF9", accent: "#7AA2F7", line: "#292524" },
  },
  sand: {
    label: "砂 · 米白赤陶",
    light: { bg: "#FBF7F1", soft: "#F3EBDF", fg: "#2B2118", accent: "#B4532A", line: "#E8DCCB" },
    dark: { bg: "#1A140F", soft: "#251C15", fg: "#F5EDE3", accent: "#E08A5E", line: "#3A2E24" },
  },
  sage: {
    label: "苔 · 鼠尾草綠",
    light: { bg: "#F7F9F6", soft: "#E9EFE6", fg: "#1E2A1F", accent: "#4F7A55", line: "#D9E2D5" },
    dark: { bg: "#111612", soft: "#1A211B", fg: "#E9F0E7", accent: "#8DBF93", line: "#2A342B" },
  },
  blush: {
    label: "胭 · 粉與梅",
    light: { bg: "#FFF8F7", soft: "#FBE9E7", fg: "#3A1F2B", accent: "#B0476B", line: "#F1D6D4" },
    dark: { bg: "#1C1216", soft: "#281A20", fg: "#FBEAEE", accent: "#F08AAE", line: "#3D2830" },
  },
  night: {
    label: "夜 · 炭與琥珀",
    light: { bg: "#F4F4F2", soft: "#E8E8E4", fg: "#151515", accent: "#B06A06", line: "#DADAD5" },
    dark: { bg: "#111111", soft: "#1B1B1B", fg: "#EDEDE9", accent: "#F5B342", line: "#2B2B2B" },
  },
  oat: {
    label: "穀 · 燕麥橄欖",
    light: { bg: "#F6F3EC", soft: "#ECE6D8", fg: "#2E2A22", accent: "#66652A", line: "#DDD5C3" },
    dark: { bg: "#16140F", soft: "#211E17", fg: "#EFEADF", accent: "#B8B56A", line: "#36322A" },
  },
} satisfies Record<string, Palette>;

export type PaletteName = keyof typeof PALETTES;
