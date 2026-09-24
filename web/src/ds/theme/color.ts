// Small colour toolkit for deriving roles from palette seeds. The LLM never
// supplies a hex value; every colour on screen is computed from 5 seeds here,
// so contrast is guaranteed by code, not by the model's taste.

type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: RGB): string {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}

// `amount` of `a`, the rest `b` (sRGB; good enough for UI tints).
export function mix(a: string, b: string, amount: number): string {
  const x = hexToRgb(a), y = hexToRgb(b);
  return rgbToHex([0, 1, 2].map((i) => x[i] * amount + y[i] * (1 - amount)) as RGB);
}

function luminance(hex: string): number {
  const c = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// Whichever candidate reads best on `bg`.
export function bestOn(bg: string, candidates: string[]): string {
  return candidates.reduce((best, c) => (contrast(bg, c) > contrast(bg, best) ? c : best));
}

// Hover colour derived from the base (the same idea as Horizon's hover shift:
// very dark colours lighten noticeably, light ones darken a little).
export function hoverShift(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  if (brightness <= 40) return mix("#ffffff", hex, 0.15);
  if (brightness <= 128) return mix("#ffffff", hex, 0.08);
  if (brightness <= 190) return mix("#000000", hex, 0.1);
  return mix("#000000", hex, 0.05);
}

// Nudge `color` toward `toward` until it reaches `min` contrast against `bg`.
// This is the guard that makes "the LLM can't produce unreadable text" true:
// whatever palette and surface it picks, roles are pushed until they pass.
export function ensureContrast(color: string, bg: string, min: number, toward?: string): string {
  const target = toward ?? bestOn(bg, ["#000000", "#FFFFFF"]);
  for (let t = 0; t <= 1.0001; t += 0.02) {
    const c = mix(target, color, t);
    if (contrast(c, bg) >= min) return c;
  }
  return target;
}
