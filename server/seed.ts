import type { UserPrefs } from "../shared/decision.ts";
import { EMPTY_PERSONA } from "../shared/personas.ts";

// The product catalog lives in shared/catalog.ts (CATALOG) so the frontend
// and the seed can't drift apart. Only users are seeded from here.

// Five shoppers so the demo shows the four stores (and a cold start) at once.
// The ids are fixed — the frontend's user picker relies on them.
export const SEED_USERS: { id: string; name: string; prefs: UserPrefs }[] = [
  {
    id: "u_ines", name: "Ines",
    prefs: {
      archetype: "auto", scheme: "auto", budget: null, categories: ["table", "brew"],
      need: "想找能用很久、有故事的東西",
      persona: { mbti: "INFP", zodiac: "雙魚", traits: ["內向", "感性", "慢活", "念舊"], interests: ["閱讀", "手沖咖啡", "陶藝", "茶"] },
    },
  },
  {
    id: "u_leo", name: "Leo",
    prefs: {
      archetype: "auto", scheme: "auto", budget: null, categories: ["carry", "home"],
      need: "週末要去露營,想帶點不一樣的",
      persona: { mbti: "ENFP", zodiac: "射手", traits: ["外向", "好奇", "衝動", "愛冒險"], interests: ["露營", "音樂祭", "攝影", "植物"] },
    },
  },
  {
    id: "u_ada", name: "Ada",
    prefs: {
      archetype: "auto", scheme: "auto", budget: null, categories: ["paper"],
      need: "比較規格再決定,不喜歡廣告感",
      persona: { mbti: "INTJ", zodiac: "摩羯", traits: ["內向", "理性", "重設計"], interests: ["鋼筆", "手帳", "設計"] },
    },
  },
  {
    id: "u_ken", name: "Ken",
    prefs: {
      archetype: "auto", scheme: "auto", budget: 1500, categories: [],
      need: "要送客戶的禮物,預算有限,越快越好",
      persona: { mbti: "ESTJ", zodiac: "處女", traits: ["外向", "務實", "比價", "愛送禮"], interests: ["通勤", "送禮"] },
    },
  },
  {
    id: "u_new", name: "新訪客",
    prefs: { archetype: "auto", scheme: "auto", budget: null, categories: [], need: "", persona: { ...EMPTY_PERSONA } },
  },
];
