// Who the shopper is: MBTI, zodiac, traits, interests. These are *inputs* to
// the decision engines (the LLM reads them; the rule engine scores them).

export const MBTI_TYPES = [
  "INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", "ENFP",
  "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP",
] as const;
export type MBTI = (typeof MBTI_TYPES)[number];

export const ZODIACS = [
  "牡羊", "金牛", "雙子", "巨蟹", "獅子", "處女", "天秤", "天蠍", "射手", "摩羯", "水瓶", "雙魚",
] as const;
export type Zodiac = (typeof ZODIACS)[number];

export const ZODIAC_ELEMENT: Record<Zodiac, "fire" | "earth" | "air" | "water"> = {
  牡羊: "fire", 獅子: "fire", 射手: "fire",
  金牛: "earth", 處女: "earth", 摩羯: "earth",
  雙子: "air", 天秤: "air", 水瓶: "air",
  巨蟹: "water", 天蠍: "water", 雙魚: "water",
};

export const TRAITS = [
  "內向", "外向", "感性", "理性", "慢活", "衝動", "好奇", "務實",
  "比價", "念舊", "愛冒險", "夜貓子", "重設計", "愛送禮",
] as const;
export type Trait = (typeof TRAITS)[number];

export const INTERESTS = [
  "閱讀", "手沖咖啡", "茶", "陶藝", "香氛", "植物", "露營", "攝影", "音樂祭",
  "鋼筆", "手帳", "設計", "烹飪", "通勤", "送禮",
] as const;
export type Interest = (typeof INTERESTS)[number];

export interface Persona {
  mbti: MBTI | null;
  zodiac: Zodiac | null;
  traits: Trait[];
  interests: Interest[];
  // Guessed from behaviour (a subset of traits), and guesses the shopper removed
  // — never guessed again. See shared/infer.ts.
  inferred?: Trait[];
  rejected?: Trait[];
}

export const EMPTY_PERSONA: Persona = { mbti: null, zodiac: null, traits: [], interests: [] };
