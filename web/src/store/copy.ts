// Every word the shopper sees. The decision engines only emit enums; this is
// where they become language — in each archetype's own voice. The same intent
// reads differently in a magazine than in a spec sheet or a bargain bin.
import type { Archetype, Decision, DecisionSource } from "../../../shared/decision";
import type { ShopCategory } from "../../../shared/catalog";
import type { ChatChange } from "../../../shared/chat";

export const STORE_NAME = "日常所";
export const STORE_NAME_EN = "Everyday Supply";

export const ARCHETYPE_LABEL: Record<Archetype, { name: string; who: string }> = {
  editorial: { name: "雜誌", who: "慢慢讀、喜歡故事的人" },
  collage: { name: "拼貼", who: "好奇、愛驚喜的人" },
  index: { name: "索引", who: "理性比較規格的人" },
  deal: { name: "特賣", who: "務實、趕時間的人" },
};

type Intent = Decision["sections"][number]["intent"];

// [title, subtitle] per archetype voice.
export const INTENT_COPY: Record<Archetype, Record<Intent, [string, string]>> = {
  editorial: {
    for_you: ["為你挑的幾件", "依你最近停留的東西"],
    trending: ["這週被帶回家最多的", "大家的選擇"],
    deals: ["難得的好價格", "期間限定"],
    low_stock: ["最後幾件", "手作的東西,做完就沒了"],
    because_viewed: ["延續你的閱讀", "和你看過的相近"],
    budget_picks: ["預算之內", "不必勉強也能好好生活"],
    gift_ideas: ["適合送人的", "收到的人會記得很久"],
    new_arrivals: ["新到的", "本週上架"],
    maker_story: ["製作的人", "東西背後的故事"],
    category: ["依類別", "慢慢逛"],
  },
  collage: {
    for_you: ["你可能會尖叫的", "看你的眼光挑的!"],
    trending: ["大家都在搶", "手刀加入"],
    deals: ["撿到便宜啦", "現在買最划算"],
    low_stock: ["快沒了快沒了", "晚一步就沒了"],
    because_viewed: ["你剛剛看過的朋友們", "一起帶走更開心"],
    budget_picks: ["小錢也能快樂", "預算友善區"],
    gift_ideas: ["送禮不踩雷", "收到會笑出來"],
    new_arrivals: ["剛到貨!", "新鮮熱辣"],
    maker_story: ["做這些的人", "認識一下"],
    category: ["想逛哪一區?", "點一個試試"],
  },
  index: {
    for_you: ["Selected / 精選", "依瀏覽紀錄與偏好排序"],
    trending: ["Most sold / 銷量", "依售出件數排序"],
    deals: ["Below list / 低於定價", "依折扣幅度排序"],
    low_stock: ["Low stock / 低庫存", "庫存 ≤ 5"],
    because_viewed: ["Related / 相關", "同類別"],
    budget_picks: ["Within budget / 預算內", "≤ 你設定的上限"],
    gift_ideas: ["Gift / 禮品", "標籤:gift"],
    new_arrivals: ["New / 新品", "本週上架"],
    maker_story: ["Makers / 製作者", "產地與工坊"],
    category: ["Categories / 分類", "全部 6 類"],
  },
  deal: {
    for_you: ["猜你想買", "依你的預算與紀錄"],
    trending: ["熱銷排行", "賣最好的都在這"],
    deals: ["限時降價", "價格隨時會變"],
    low_stock: ["即將售完", "庫存少於 5 件"],
    because_viewed: ["看過的相關商品", "比價看這裡"],
    budget_picks: ["預算內好物", "不超過你的上限"],
    gift_ideas: ["送禮首選", "包裝好直接送"],
    new_arrivals: ["新品上架", "搶先入手"],
    maker_story: ["品牌專區", "產地直送"],
    category: ["分類快選", "一鍵直達"],
  },
};

export const HEADLINE_COPY: Record<Decision["hero"]["headline"], { eyebrow: string; title: string; body: string }> = {
  slow_living: { eyebrow: "本週選物", title: "日常裡的好東西", body: "不追新,只挑用得久的。每一件都在我們的桌上用過一陣子,才放上來。" },
  made_by_hand: { eyebrow: "手作週", title: "手的溫度,每天用得到", body: "在轆轤上拉出來的杯子,釉色因窯裡的位置而不同。那不是瑕疵,是它獨一無二的地方。" },
  new_this_week: { eyebrow: "新到貨", title: "這週剛到的", body: "從鶯歌、台南到京都,這週有幾件新朋友。" },
  for_you: { eyebrow: "為你", title: "依你的喜好排好了", body: "我們根據你停留過的東西,重新安排了這家店。" },
  gift_season: { eyebrow: "送禮", title: "送一件會被用很久的東西", body: "比起昂貴,更重要的是它會出現在對方每天的生活裡。" },
  deals_now: { eyebrow: "FLASH SALE", title: "限時降價中", body: "價格隨時在變,看到喜歡的就先放進購物車。" },
  last_chance: { eyebrow: "最後機會", title: "快賣完了", body: "這些品項庫存只剩個位數。" },
  the_index: { eyebrow: "INDEX", title: "選物索引", body: "24 件、6 類、每一件的產地、價格與庫存。沒有形容詞。" },
  weekend_adventure: { eyebrow: "週末去哪?", title: "帶點不一樣的出門", body: "露營、市集、音樂祭 —— 這些小東西會讓週末更好玩。" },
};

export const ANNOUNCEMENT_COPY: Record<Decision["header"]["announcement"], string | null> = {
  none: null,
  free_shipping: "滿 NT$1,500 免運",
  flash_sale: "限時降價進行中 · 每小時更新",
  new_arrivals: "新品到貨!本週 4 件新朋友",
  maker_week: "手作週 · 認識做這些東西的人",
};

export const CATEGORY_COPY: Record<ShopCategory, { label: string; en: string; blurb: string }> = {
  table: { label: "餐桌器皿", en: "Tableware", blurb: "杯、盤、砧板與水瓶" },
  brew: { label: "咖啡與茶", en: "Coffee & Tea", blurb: "豆子、茶葉與沖煮器具" },
  scent: { label: "香氛保養", en: "Scent & Care", blurb: "蠟燭、精油與手部保養" },
  paper: { label: "文具紙品", en: "Paper Goods", blurb: "筆記本、鋼筆與明信片" },
  home: { label: "居家擺設", en: "Home", blurb: "花器、植物、燈與織品" },
  carry: { label: "隨身日常", en: "Everyday Carry", blurb: "包、夾、眼鏡與保溫杯" },
};

// Maker stories for the editorial `story` section, by category of its lead product.
export const STORY_COPY: Record<ShopCategory, string> = {
  table: "工作室在鶯歌老街後面的巷子裡。每天早上先拉坯,下午修坯、上釉,一窯要等三天。他說,杯子最重要的不是好看,是拿起來的重量剛剛好。",
  brew: "從產地挑豆、自己烘焙,每批只烘十公斤。烘豆師相信淺焙才喝得出土地的味道,所以每一包都寫著產區和海拔。",
  scent: "在台中的小工作室裡手工調香,蠟用的是大豆蠟,燭芯是木頭的。點起來會有細細的劈啪聲,像在壁爐旁。",
  paper: "活版印刷機是從老印刷廠搬來的,鉛字一個一個撿。每張明信片的壓痕深淺都不太一樣。",
  home: "花器是用剩下的陶土捏的,每一只的形狀都不一樣。她說,花插進去之後,器物才算完成。",
  carry: "帆布是台中老布行的厚磅帆布,一針一針車縫。用久了會出現自己的皺摺,那才是它最好看的時候。",
};

export const SIGNAL_LABEL: Record<Decision["signals"][number], string> = {
  cold_start: "新訪客", persona_introvert: "內向", persona_extrovert: "外向", persona_feeling: "感性",
  persona_thinking: "理性", persona_practical: "務實", persona_curious: "好奇", zodiac_element: "星座元素",
  interest_match: "興趣相符", category_affinity: "分類偏好", price_sensitive: "價格敏感", premium_taste: "偏好質感",
  cart_intent: "購物車意圖", stock_urgency: "庫存急迫", price_drop: "有降價", explicit_need: "明確需求",
  gift_intent: "送禮需求", budget_cap: "有預算上限", night_owl: "夜貓子", inferred_persona: "從逛法推測個性",
};

// Which engine made the decision: long form in the panel, short on the pill.
export const SOURCE_LABEL: Record<DecisionSource, string> = { typesafe: " TypeSafe Jev ", claude: " Claude ", rules: "規則引擎" };
export const SOURCE_SHORT: Record<DecisionSource, string> = { typesafe: "Jev", claude: "Claude", rules: "規則" };

export const TRIGGER_LABEL: Record<string, string> = {
  open: "開啟頁面", view: "瀏覽商品", favorite: "收藏", search: "搜尋", add_to_cart: "加入購物車",
  remove_from_cart: "移出購物車", purchase: "完成購買", prefs: "更新你的資料",
  "market:sold_out": "商品售完", "market:restock": "補貨", "market:price_drop": "有商品降價",
};

export const FREE_SHIPPING = 1500;

// ---- chat -------------------------------------------------------------------
// The chat's own words, per store voice. When an AI reply is available it is
// shown instead of `reply`; the change chips and product cards are always ours.

export const CHAT_COPY: Record<Archetype, {
  title: string; placeholder: string; greeting: string; suggestions: string[];
  reply: (changed: boolean) => string;
}> = {
  editorial: {
    title: "和店員聊聊", placeholder: "說說你最近的日子,或想找什麼⋯",
    greeting: "午安。最近過得如何?告訴我你的近況或想找的東西,我替你重新佈置這家店。",
    suggestions: ["最近好累,想要放鬆的東西", "想找有故事的手作器皿", "晚上看書時用的"],
    reply: (c) => (c ? "明白了。我照你說的,把店裡慢慢重新擺過一遍。" : "我聽著。多說一點,我再替你調整。"),
  },
  collage: {
    title: "聊天!", placeholder: "今天想玩什麼?",
    greeting: "嗨!想要什麼驚喜?跟我說,店面馬上變給你看!",
    suggestions: ["週末要去露營!", "給我一點沒看過的東西", "想送朋友生日禮物,1000 以內"],
    reply: (c) => (c ? "收到!店面已經幫你大改造了,往下看看!" : "嗯嗯,再多講一點,我來變點新花樣!"),
  },
  index: {
    title: "查詢", placeholder: "輸入需求、預算或偏好",
    greeting: "請描述需求、預算或偏好。系統會依條件重新排序。",
    suggestions: ["預算 800 以內的文具", "想比較幾款保溫杯", "我是 INTJ"],
    reply: (c) => (c ? "已依條件更新排序。" : "未偵測到新條件。可補充預算、分類或用途。"),
  },
  deal: {
    title: "問店員", placeholder: "要買什麼?預算多少?",
    greeting: "要找什麼?講預算,我幫你挑最划算的。",
    suggestions: ["500 以內送同事的禮物", "有什麼在特價?", "要快,明天就要用"],
    reply: (c) => (c ? "好,照你的條件排好了,划算的在前面。" : "講一下預算或用途,我幫你篩。"),
  },
};

export const CHAT_UI = {
  thinking: "正在想⋯",
  failed: "剛剛沒接上,再說一次好嗎?",
  aiNote: { claude: "Claude 讀懂並回覆", typesafe: "Jev 讀懂", rules: "關鍵字判斷" } as const,
  open: "聊天",
  close: "關閉聊天",
  send: "送出",
};

export function changeLabel(c: ChatChange): string {
  switch (c.kind) {
    case "trait": return `個性 +${c.value}`;
    case "interest": return `興趣 +${c.value}`;
    case "category": return `想看 ${CATEGORY_COPY[c.value].label}`;
    case "budget": return c.value === null ? "不限預算" : `預算 ${c.value} 元`;
    case "need": return `需求:${c.value}`;
    case "scheme": return c.value === "dark" ? "換成暗色" : "換成亮色";
    case "archetype": return c.value === "auto" ? "店型交給 AI" : `換成${ARCHETYPE_LABEL[c.value].name}店`;
    case "mbti": return `MBTI ${c.value}`;
    case "zodiac": return `${c.value}座`;
  }
}

// ---- traits guessed from behaviour (shared/infer.ts) -------------------------
export const INFER_COPY = {
  toast: (traits: string[]) => `看你的逛法,猜你是「${traits.join("、")}」`,
  toastHint: "店面會照這個調整 · 點這裡修改",
  chip: "猜",
  chipTitle: "從你的逛法推測的;點掉就不會再猜",
  panelHint: "虛線的是從你的逛法猜的。點掉就不會再猜。",
};

// ---- first visit: welcome card + guided chat --------------------------------
// The demo's story: first the store learns *who you are* (style & layout
// follow), then *what you're looking for* (products follow).
export const GUIDE_COPY = {
  unknownPersona: "還不認識你 · 點我",
  welcome: {
    eyebrow: "日常所 · 會變的選物店",
    title: "這家店會長成你的樣子",
    body: "先讓店認識你:MBTI、星座、個性、喜歡的風格。每回答一題,店的風格和版面就會跟著變。認識你之後,再告訴我們你想找什麼。",
    chat: "💬 聊聊,讓店認識你",
    pick: "直接選特質",
    browse: "先隨便逛逛",
  },
  mbti: { ask: "先認識你一下。你的 MBTI 是?", skip: "不知道", ack: (v: string) => `${v},記下了。看看店的樣子,已經跟著變了。` },
  zodiac: { ask: "星座呢?", skip: "跳過", ack: (v: string) => `${v}座。店也跟著調了一點。` },
  traits: { ask: "哪幾個詞最像你?可以多選,選好按「好了」。", done: "好了", skip: "跳過", ack: (vs: string[]) => `${vs.join("、")},懂了。` },
  style: { ask: "你喜歡逛哪種店?", auto: "你幫我決定", autoAck: "好,交給我依你的個性決定。", ack: (v: string) => `好,就照「${v}」來。` },
  scheme: { ask: "最後,亮一點還是暗一點?", light: "亮一點", dark: "暗一點", auto: "都可以", ack: (v: string) => `${v},好。` },
  skipped: "沒關係,跳過。",
  done: "店已經照你的樣子排好了。現在想找什麼?直接說就好:預算、送誰、什麼場合都可以。",
  productSuggestions: ["想找送朋友的生日禮物,1000 以內", "最近想好好泡一杯咖啡", "有什麼新東西?"],
  skipAll: "跳過,直接聊",
  step: (i: number, n: number) => `認識你 ${i}/${n}`,
};
