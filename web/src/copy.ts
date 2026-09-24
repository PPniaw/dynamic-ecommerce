// Every word the shopper sees. The decision engine only emits enums; this is
// where they become language. (Swap this file to localise the whole store.)
import type { ActivityItem, Category, Decision } from "../../shared/decision";

export const CATEGORY_LABEL: Record<Category, string> = {
  "3c": "3C 數位", fashion: "服飾配件", home: "居家生活", outdoor: "戶外運動", beauty: "美妝保養", food: "美食飲品",
};

type Kind = Decision["sections"][number]["kind"];
export const SECTION_TITLE: Record<Kind, string> = {
  for_you: "為你挑選",
  trending: "大家都在買",
  deals: "限時降價",
  low_stock: "快搶完了",
  category: "你常逛的分類",
  because_viewed: "因為你看過",
  budget_picks: "預算內好物",
  gift_ideas: "送禮靈感",
  premium_picks: "質感精選",
};

export const HERO_EYEBROW: Record<Decision["hero"]["variant"], string> = {
  spotlight: "今日焦點",
  deal: "現在最划算",
  restock_alert: "剛補貨",
  new_arrival: "新上架",
  gift: "送這個準沒錯",
  last_chance: "最後幾件",
};

export const BADGE: Record<Decision["badges"][number]["badge"], { label: string; color: string }> = {
  hot: { label: "熱賣", color: "red" },
  deal: { label: "優惠", color: "orange" },
  low_stock: { label: "少量", color: "yellow" },
  for_you: { label: "推薦", color: "violet" },
  new: { label: "新品", color: "teal" },
  price_drop: { label: "降價", color: "green" },
};

export const SIGNAL_LABEL: Record<Decision["signals"][number], string> = {
  cold_start: "新訪客",
  category_affinity: "分類偏好",
  price_sensitive: "價格敏感",
  premium_taste: "偏好質感",
  dark_preference: "暗色風格",
  minimal_style: "極簡風格",
  vivid_style: "繽紛風格",
  cart_intent: "購物車意圖",
  stock_urgency: "庫存急迫",
  price_drop: "有降價",
  explicit_need: "明確需求",
  gift_intent: "送禮需求",
  budget_cap: "有預算上限",
};

export const TRIGGER_LABEL: Record<string, string> = {
  open: "開啟頁面", view: "瀏覽商品", favorite: "收藏", search: "搜尋", add_to_cart: "加入購物車",
  remove_from_cart: "移出購物車", purchase: "完成購買", prefs: "更新喜好",
  "market:sold_out": "商品售完", "market:restock": "補貨", "market:price_drop": "有商品降價",
};

export function activityText(a: ActivityItem, name: string): string {
  switch (a.kind) {
    case "sold": return `有人買了 ${a.qty} 件「${name}」`;
    case "sold_out": return `「${name}」剛剛賣完了`;
    case "restock": return `「${name}」補貨 ${a.qty} 件`;
    case "price_drop": return `「${name}」降價 ${money(a.from!)} → ${money(a.to!)}`;
    case "price_up": return `「${name}」調價 ${money(a.from!)} → ${money(a.to!)}`;
  }
}

export const money = (n: number) => `NT$${n.toLocaleString("zh-TW")}`;
