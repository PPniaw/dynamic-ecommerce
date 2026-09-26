// Vibes: the look laid over an archetype. The archetype decides the *layout*
// (magazine / collage / index / deal); the vibe decides how it *feels* —
// palette, type, shape, plus textures and heading/card treatments in
// tokens.css ([data-vibe]). Any archetype × any vibe is a valid store.
//
// A vibe pins the fields that make it recognisable (palette, fonts, radius…),
// so an engine can't pick "y2k" and then a palette that fights it.
import type { Decision, UserPrefs, Vibe } from "./decision.ts";
import { ZODIAC_ELEMENT, type Persona } from "./personas.ts";

type Theme = Decision["theme"];

export const VIBE_STYLE: Record<Exclude<Vibe, "none">, Partial<Theme> & { scheme: Theme["scheme"] }> = {
  // 復古:米黃紙、焦橘、粗襯線標題、顆粒紋理、照片微泛黃。
  retro: { palette: "retro", fonts: "retro", radius: "soft", headingCase: "none", elevation: "flat", hoverEffect: "zoom", scheme: "light" },
  // Y2K 韓系:粉紫漸層、泡泡圓角、寬圓字、亮面光澤。
  y2k: { palette: "y2k", fonts: "y2k", radius: "pill", headingCase: "none", elevation: "soft", hoverEffect: "scale", scheme: "light" },
  // 科幻金屬:深色鋼、青色光、銳角、未來感字型、網格。
  scifi: { palette: "metal", fonts: "scifi", radius: "sharp", headingCase: "uppercase", elevation: "flat", hoverEffect: "lift", scheme: "dark" },
};

// Apply a vibe to a theme. The shopper's explicit light/dark choice always wins
// over the vibe's default scheme.
export function applyVibe(theme: Theme, schemePref: UserPrefs["scheme"] = "auto"): Theme {
  // Unknown / missing (prefs saved before vibes existed) = no vibe.
  const style = VIBE_STYLE[theme.vibe as keyof typeof VIBE_STYLE] as (typeof VIBE_STYLE)[keyof typeof VIBE_STYLE] | undefined;
  if (!style) return { ...theme, vibe: "none" };
  const { scheme, ...pin } = style;
  return { ...theme, ...pin, scheme: schemePref !== "auto" ? schemePref : scheme };
}

// Rule engine: a transparent guess from the persona. Needs two clues, else none.
export function vibeFromPersona(p: Persona): Vibe {
  const s: Record<Exclude<Vibe, "none">, number> = { retro: 0, y2k: 0, scifi: 0 };
  const t = new Set<string>([...p.traits, ...p.interests]);
  const add = (v: keyof typeof s, n: number, ...keys: string[]) => { for (const k of keys) if (t.has(k)) s[v] += n; };
  add("retro", 1, "念舊", "慢活", "閱讀", "陶藝", "茶", "手沖咖啡");
  add("y2k", 1, "外向", "好奇", "衝動", "音樂祭", "攝影", "愛冒險");
  add("scifi", 1, "理性", "重設計", "設計", "夜貓子", "鋼筆");
  const m = p.mbti ?? "";
  if (/^E.FP$/.test(m)) s.y2k += 1;
  if (/^.NT.$/.test(m)) s.scifi += 1;
  if (/^I.F.$/.test(m)) s.retro += 0.5;
  if (p.zodiac) {
    if (p.zodiac === "水瓶") s.scifi += 1;
    else if (p.zodiac === "雙子" || p.zodiac === "射手") s.y2k += 1;
    else if (p.zodiac === "金牛" || p.zodiac === "巨蟹") s.retro += 1;
    else if (ZODIAC_ELEMENT[p.zodiac] === "air") s.scifi += 0.5;
  }
  const [best, v] = (Object.entries(s) as [keyof typeof s, number][]).sort((a, b) => b[1] - a[1])[0];
  return v >= 2 ? best : "none";
}

// A vibe asked for by name in chat ("復古一點", "想要 Y2K 韓系", "科幻感").
const VIBE_WORDS: [Vibe, RegExp][] = [
  ["retro", /復古|懷舊|老派|古著|retro|vintage|70年代|80年代/i],
  ["y2k", /y2k|韓系|韓風|千禧|辣妹|甜酷|少女時代|泡泡/i],
  ["scifi", /科幻|金屬|賽博|cyber|未來感|太空|機甲|銀色|鉻/i],
  ["none", /簡約|乾淨一點|素一點|不要花|普通就好|原本的風格/],
];
export const namedVibe = (text: string): Vibe | undefined => VIBE_WORDS.find(([, re]) => re.test(text))?.[0];
