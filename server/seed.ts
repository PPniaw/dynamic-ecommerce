import type { Category, UserPrefs } from "../shared/decision.ts";

// Tag vocabulary the engines understand: minimal, vivid, premium, budget,
// gift, eco, dark, cute, pro.
type Seed = { id: string; name: string; emoji: string; category: Category; price: number; stock: number; tags: string[] };

export const SEED_PRODUCTS: Seed[] = [
  { id: "p01", name: "降噪無線耳機", emoji: "🎧", category: "3c", price: 5990, stock: 24, tags: ["premium", "dark", "pro"] },
  { id: "p02", name: "機械鍵盤 茶軸", emoji: "⌨️", category: "3c", price: 3290, stock: 18, tags: ["pro", "dark"] },
  { id: "p03", name: "65W 氮化鎵充電器", emoji: "🔌", category: "3c", price: 890, stock: 60, tags: ["budget", "minimal"] },
  { id: "p04", name: "智慧手錶", emoji: "⌚", category: "3c", price: 7490, stock: 12, tags: ["premium", "gift"] },
  { id: "p05", name: "拍立得相機", emoji: "📸", category: "3c", price: 2990, stock: 9, tags: ["vivid", "gift", "cute"] },
  { id: "p06", name: "藍牙小音箱", emoji: "🔊", category: "3c", price: 1290, stock: 30, tags: ["vivid", "budget", "gift"] },
  { id: "p07", name: "4K 網路攝影機", emoji: "🎥", category: "3c", price: 2490, stock: 15, tags: ["pro", "minimal"] },

  { id: "p10", name: "有機棉素T", emoji: "👕", category: "fashion", price: 590, stock: 80, tags: ["minimal", "eco", "budget"] },
  { id: "p11", name: "羊毛大衣", emoji: "🧥", category: "fashion", price: 6800, stock: 7, tags: ["premium", "minimal", "dark"] },
  { id: "p12", name: "復古球鞋", emoji: "👟", category: "fashion", price: 2780, stock: 20, tags: ["vivid"] },
  { id: "p13", name: "帆布托特包", emoji: "👜", category: "fashion", price: 790, stock: 45, tags: ["minimal", "eco", "gift"] },
  { id: "p14", name: "針織毛帽", emoji: "🧢", category: "fashion", price: 450, stock: 50, tags: ["cute", "budget", "vivid"] },
  { id: "p15", name: "真皮短夾", emoji: "👛", category: "fashion", price: 1980, stock: 16, tags: ["premium", "gift", "dark"] },

  { id: "p20", name: "手沖咖啡組", emoji: "☕", category: "home", price: 1680, stock: 22, tags: ["minimal", "gift"] },
  { id: "p21", name: "香氛蠟燭", emoji: "🕯️", category: "home", price: 680, stock: 40, tags: ["gift", "cute"] },
  { id: "p22", name: "北歐落地燈", emoji: "💡", category: "home", price: 3480, stock: 8, tags: ["minimal", "premium"] },
  { id: "p23", name: "觀葉植物 龜背芋", emoji: "🪴", category: "home", price: 890, stock: 25, tags: ["eco", "vivid"] },
  { id: "p24", name: "記憶枕", emoji: "🛏️", category: "home", price: 1290, stock: 35, tags: ["budget"] },
  { id: "p25", name: "陶瓷餐盤組", emoji: "🍽️", category: "home", price: 1450, stock: 14, tags: ["minimal", "gift"] },

  { id: "p30", name: "輕量登山背包", emoji: "🎒", category: "outdoor", price: 2680, stock: 17, tags: ["pro", "vivid"] },
  { id: "p31", name: "雙人帳篷", emoji: "⛺", category: "outdoor", price: 4580, stock: 6, tags: ["pro"] },
  { id: "p32", name: "保溫水壺", emoji: "🧴", category: "outdoor", price: 780, stock: 55, tags: ["eco", "budget", "minimal"] },
  { id: "p33", name: "頭燈", emoji: "🔦", category: "outdoor", price: 650, stock: 40, tags: ["budget", "pro"] },
  { id: "p34", name: "瑜珈墊", emoji: "🧘", category: "outdoor", price: 990, stock: 30, tags: ["eco", "vivid"] },
  { id: "p35", name: "折疊露營椅", emoji: "🪑", category: "outdoor", price: 1350, stock: 21, tags: ["budget"] },

  { id: "p40", name: "玻尿酸精華", emoji: "💧", category: "beauty", price: 1280, stock: 33, tags: ["premium", "minimal"] },
  { id: "p41", name: "霧面唇膏", emoji: "💄", category: "beauty", price: 690, stock: 48, tags: ["vivid", "gift", "cute"] },
  { id: "p42", name: "香水 30ml", emoji: "🌸", category: "beauty", price: 3200, stock: 11, tags: ["premium", "gift"] },
  { id: "p43", name: "防曬乳", emoji: "🧴", category: "beauty", price: 520, stock: 70, tags: ["budget"] },
  { id: "p44", name: "手工皂禮盒", emoji: "🧼", category: "beauty", price: 880, stock: 26, tags: ["eco", "gift", "cute"] },

  { id: "p50", name: "單品咖啡豆", emoji: "🫘", category: "food", price: 480, stock: 60, tags: ["minimal", "budget"] },
  { id: "p51", name: "手工巧克力", emoji: "🍫", category: "food", price: 650, stock: 38, tags: ["gift", "premium", "dark"] },
  { id: "p52", name: "高山茶禮盒", emoji: "🍵", category: "food", price: 1580, stock: 19, tags: ["gift", "premium"] },
  { id: "p53", name: "堅果隨手包", emoji: "🥜", category: "food", price: 399, stock: 90, tags: ["budget", "eco"] },
  { id: "p54", name: "果乾綜合罐", emoji: "🍓", category: "food", price: 450, stock: 44, tags: ["vivid", "cute", "budget"] },
];

// Three personas so the demo shows different storefronts immediately.
export const SEED_USERS: { id: string; name: string; prefs: UserPrefs }[] = [
  { id: "u_minimal", name: "極簡上班族", prefs: { style: "minimal", budget: 3000, categories: ["home", "3c"], need: "" } },
  { id: "u_outdoor", name: "週末山友", prefs: { style: "vivid", budget: null, categories: ["outdoor"], need: "下個月要去合歡山露營" } },
  { id: "u_gift", name: "送禮苦手", prefs: { style: "auto", budget: 2000, categories: [], need: "女友生日禮物,她喜歡可愛的東西" } },
];
