// Chat → preferences. What the shopper says is turned into an update of their
// UserPrefs (enums only) and the store re-decides immediately. Three readers
// produce the same ChatUpdate:
//
//   Claude (sample, in the published preview) — reads and also writes a reply
//   Jev (server, TYPESAFE_API_KEY)            — reads only
//   keywords (below)                          — reads only; offline fallback
//
// The reply is the one place an LLM writes words the shopper sees. It never
// states prices or stock: the product cards under it render those from live data.
import { z } from "zod/v4";
import { SHOP_CATEGORIES, type ShopCategory } from "./catalog.ts";
import { ARCHETYPES, type Archetype, type Profile, type UserPrefs } from "./decision.ts";
import { declareTraits } from "./infer.ts";
import { INTERESTS, MBTI_TYPES, TRAITS, ZODIACS, type Interest, type Trait } from "./personas.ts";

export interface ChatTurn { role: "user" | "assistant"; text: string }

export const ChatUpdateSchema = z.object({
  traitsAdd: z.array(z.enum(TRAITS)),
  interestsAdd: z.array(z.enum(INTERESTS)),
  // What they want to look at now; [] = no change.
  categories: z.array(z.enum(SHOP_CATEGORIES)),
  // "keep", "none" (drop the cap) or a number of NT$.
  budget: z.union([z.literal("keep"), z.literal("none"), z.number()]),
  // A concrete shopping need in the shopper's words (≤ 60 chars), or "" for none.
  need: z.string(),
  scheme: z.enum(["keep", "light", "dark"]),
  archetype: z.enum(["keep", "auto", ...ARCHETYPES]),
  // Only when the shopper says it outright.
  mbti: z.enum(["keep", ...MBTI_TYPES]),
  zodiac: z.enum(["keep", ...ZODIACS]),
});
export type ChatUpdate = z.infer<typeof ChatUpdateSchema>;

export const NO_UPDATE: ChatUpdate = {
  traitsAdd: [], interestsAdd: [], categories: [], budget: "keep", need: "", scheme: "keep", archetype: "keep", mbti: "keep", zodiac: "keep",
};

export type ChatChange =
  | { kind: "trait" | "interest"; value: string }
  | { kind: "category"; value: ShopCategory }
  | { kind: "budget"; value: number | null }
  | { kind: "need"; value: string }
  | { kind: "scheme"; value: "light" | "dark" }
  | { kind: "archetype"; value: Archetype | "auto" }
  | { kind: "mbti" | "zodiac"; value: string };

export interface ChatResult {
  // null → the frontend answers with its own copy (copy.ts), in the store's voice.
  reply: string | null;
  understoodBy: "claude" | "typesafe" | "rules";
  changes: ChatChange[];
  // Products to show under the reply: the top of the new storefront.
  productIds: string[];
}

// Traits that contradict each other: adding one drops the other.
const OPPOSITE: Partial<Record<Trait, Trait>> = { 內向: "外向", 外向: "內向", 感性: "理性", 理性: "感性", 慢活: "衝動", 衝動: "慢活" };

export function applyChatUpdate(prefs: UserPrefs, u: ChatUpdate): { prefs: UserPrefs; changes: ChatChange[] } {
  const changes: ChatChange[] = [];
  const persona = { ...prefs.persona, traits: [...prefs.persona.traits], interests: [...prefs.persona.interests] };
  for (const t of u.traitsAdd) {
    if (persona.traits.includes(t)) continue;
    const opp = OPPOSITE[t];
    persona.traits = [...persona.traits.filter((x) => x !== opp), t];
    changes.push({ kind: "trait", value: t });
  }
  for (const i of u.interestsAdd) {
    if (persona.interests.includes(i)) continue;
    persona.interests.push(i);
    changes.push({ kind: "interest", value: i });
  }
  if (u.mbti !== "keep" && u.mbti !== persona.mbti) { persona.mbti = u.mbti; changes.push({ kind: "mbti", value: u.mbti }); }
  if (u.zodiac !== "keep" && u.zodiac !== persona.zodiac) { persona.zodiac = u.zodiac; changes.push({ kind: "zodiac", value: u.zodiac }); }

  const next: UserPrefs = { ...prefs, persona };
  const cats = [...new Set(u.categories)];
  if (cats.length && cats.join() !== prefs.categories.join()) {
    next.categories = cats;
    cats.forEach((c) => changes.push({ kind: "category", value: c }));
  }
  if (u.budget !== "keep") {
    const b = u.budget === "none" ? null : Math.round(u.budget);
    if (b === null || b > 0) {
      if (b !== prefs.budget) { next.budget = b; changes.push({ kind: "budget", value: b }); }
    }
  }
  const need = u.need.trim().slice(0, 60);
  if (need && need !== prefs.need) { next.need = need; changes.push({ kind: "need", value: need }); }
  if (u.scheme !== "keep" && u.scheme !== prefs.scheme) { next.scheme = u.scheme; changes.push({ kind: "scheme", value: u.scheme }); }
  if (u.archetype !== "keep" && u.archetype !== prefs.archetype) { next.archetype = u.archetype; changes.push({ kind: "archetype", value: u.archetype }); }
  // Said in chat = stated, not guessed; and a guess can't outlive its trait.
  const stated = declareTraits(next, u.traitsAdd);
  const inferred = (stated.persona.inferred ?? []).filter((t) => stated.persona.traits.includes(t));
  return { prefs: { ...stated, persona: { ...stated.persona, inferred } }, changes };
}

// ---- keyword reader (no AI) -------------------------------------------------

const TRAIT_WORDS: Partial<Record<Trait, RegExp>> = {
  慢活: /放鬆|累|慢慢|悠閒|療癒|休息|紓壓/,
  衝動: /衝動|手滑|忍不住/,
  好奇: /好奇|新奇|特別的|沒看過|驚喜/,
  務實: /實用|耐用|CP值|划算/i,
  比價: /比價|便宜|折扣|特價|優惠|打折/,
  念舊: /懷舊|復古|老派|念舊/,
  愛冒險: /冒險|探險|戶外/,
  夜貓子: /熬夜|晚上|半夜|夜貓/,
  重設計: /設計感|質感|極簡|好看/,
  愛送禮: /送禮|禮物/,
};
const INTEREST_WORDS: Partial<Record<Interest, RegExp>> = {
  閱讀: /閱讀|看書|讀書/, 手沖咖啡: /咖啡|手沖/, 茶: /喝茶|茶葉|泡茶/, 陶藝: /陶|瓷/, 香氛: /香氛|蠟燭|精油|香味/,
  植物: /植物|盆栽|花/, 露營: /露營|野營/, 攝影: /攝影|拍照|相機/, 音樂祭: /音樂祭|演唱會/, 鋼筆: /鋼筆/, 手帳: /手帳/,
  設計: /設計/, 烹飪: /煮飯|烹飪|下廚|料理/, 通勤: /通勤|上班/, 送禮: /送禮|禮物/,
};
const CATEGORY_WORDS: Record<ShopCategory, RegExp> = {
  table: /杯|盤|碗|餐具|器皿/, brew: /咖啡|茶/, scent: /香氛|蠟燭|精油|護手|保養/,
  paper: /筆記|文具|紙|鋼筆|明信片/, home: /居家|擺設|花器|燈|植物|布/, carry: /包|隨身|保溫|眼鏡|露營/,
};

export function parseBudget(text: string): ChatUpdate["budget"] {
  if (/不限預算|預算不限|不管價錢|多少錢都/.test(text)) return "none";
  const m = text.match(/(\d{2,6})\s*(?:元|塊|NT)?\s*(?:以內|以下|內|左右|上下|預算)/) ?? text.match(/預算\s*(\d{2,6})/);
  if (m) return Number(m[1]);
  const k = text.match(/(\d+(?:\.\d+)?)\s*[kK千]\s*(?:以內|以下|內|左右)?/);
  return k ? Math.round(Number(k[1]) * 1000) : "keep";
}

export function understandByKeywords(text: string): ChatUpdate {
  const pickAll = <K extends string>(m: Partial<Record<K, RegExp>>) => (Object.entries(m) as [K, RegExp][]).filter(([, re]) => re.test(text)).map(([k]) => k);
  const mbti = MBTI_TYPES.find((t) => text.toUpperCase().includes(t));
  const zodiac = ZODIACS.find((z) => text.includes(z));
  return {
    traitsAdd: pickAll(TRAIT_WORDS),
    interestsAdd: pickAll(INTEREST_WORDS),
    categories: pickAll(CATEGORY_WORDS),
    budget: parseBudget(text),
    need: /找|想要|需要|送|買/.test(text) ? text.slice(0, 60) : "",
    scheme: /暗色|深色|黑色模式|太亮/.test(text) ? "dark" : /亮色|淺色|太暗/.test(text) ? "light" : "keep",
    archetype: /特賣|便宜|折扣/.test(text) ? "deal" : "keep",
    mbti: mbti ?? "keep",
    zodiac: zodiac ?? "keep",
  };
}

// ---- Claude prompt (read + reply in one call) --------------------------------

export interface ChatContext {
  prefs: UserPrefs;
  profile: Profile;
  recent: string[];   // product names recently engaged
  cart: string[];
  archetype: Archetype; // the store they're in now — sets the reply's voice
}

const VOICE: Record<Archetype, string> = {
  editorial: "溫柔、慢、像雜誌編輯在說故事",
  collage: "活潑、有驚嘆號、像朋友分享新發現",
  index: "簡潔、理性、條列重點",
  deal: "直接、有效率、像懂行的店員",
};

export function chatPrompt(ctx: ChatContext, history: ChatTurn[], text: string): string {
  const { persona, ...prefs } = ctx.prefs;
  return `你是生活選物店「日常所」的店員。店面會依顧客的個性和需求自動改變版型與商品。
讀顧客剛說的話,做兩件事:
1. update:把話轉成顧客資料的更新。只能用下列選項,沒提到的保持 "keep" 或空陣列。
   - traitsAdd:從 ${JSON.stringify(TRAITS)} 挑出這句話明顯透露的個性
   - interestsAdd:從 ${JSON.stringify(INTERESTS)} 挑
   - categories:他現在想看的分類,從 ${JSON.stringify(SHOP_CATEGORIES)} 挑(table 餐桌器皿、brew 咖啡與茶、scent 香氛保養、paper 文具紙品、home 居家擺設、carry 隨身日常)
   - budget:"keep"、"none"(不限)或新台幣數字
   - need:具體購物需求,用他的話濃縮成 30 字內;沒有就 ""
   - scheme:"keep" | "light" | "dark"(嫌太亮 / 想要暗色才改)
   - archetype:"keep" | "auto" | "editorial"(雜誌,慢、故事)| "collage"(拼貼,好玩、驚喜)| "index"(索引,規格比較)| "deal"(特賣,價格優先)。只有他的話明確指向另一種逛法才改
   - mbti、zodiac:他明講才填(${MBTI_TYPES.join("/")};${ZODIACS.join("/")}),否則 "keep"
2. reply:用繁體中文回他 1–2 句,語氣${VOICE[ctx.archetype]}。說你幫他把店面怎麼調整了。
   不要提任何價格、折扣數字或庫存(商品卡會顯示);不要編造店裡沒有的商品。

只回 JSON:{"update":{...},"reply":"..."}

顧客資料:${JSON.stringify({ persona, ...prefs })}
行為:${JSON.stringify(ctx.profile)}
最近看過:${ctx.recent.join("、") || "無"}
購物車:${ctx.cart.join("、") || "空"}
對話紀錄:${history.slice(-6).map((t) => `${t.role === "user" ? "顧客" : "店員"}:${t.text}`).join("\n") || "無"}
顧客剛說:${text}`;
}

// Model output is untrusted: keep what parses, drop the rest.
export function parseChatAnswer(raw: unknown): { update: ChatUpdate; reply: string | null } {
  const o = (raw && typeof raw === "object" ? raw : {}) as { update?: unknown; reply?: unknown };
  const u = (o.update && typeof o.update === "object" ? o.update : {}) as Record<string, unknown>;
  const update = { ...NO_UPDATE };
  for (const k of Object.keys(NO_UPDATE) as (keyof ChatUpdate)[]) {
    const field = ChatUpdateSchema.shape[k].safeParse(u[k]);
    if (field.success) (update as Record<string, unknown>)[k] = field.data;
    else if (Array.isArray(u[k])) {
      // Keep the valid items of a partly valid list.
      const item = (ChatUpdateSchema.shape[k] as z.ZodArray<z.ZodType>).element;
      (update as Record<string, unknown>)[k] = (u[k] as unknown[]).filter((x) => item.safeParse(x).success);
    }
  }
  const reply = typeof o.reply === "string" && o.reply.trim() ? o.reply.trim().slice(0, 300) : null;
  return { update, reply };
}
