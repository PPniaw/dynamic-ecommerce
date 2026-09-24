// 生活選物店的商品目錄。
//
// Images are Unsplash photos (Unsplash License: free for commercial use, no
// attribution required), hot-linked through Unsplash's imgix CDN so we can
// ask for exact sizes and crops. The ids were picked from memory and could
// not be verified from the build container (no route to Unsplash) — the lab
// page reports any that fail, and cards fall back to a typographic tile.

export const SHOP_CATEGORIES = ["table", "brew", "scent", "paper", "home", "carry"] as const;
export type ShopCategory = (typeof SHOP_CATEGORIES)[number];

export const SHOP_CATEGORY_LABEL: Record<ShopCategory, string> = {
  table: "餐桌器皿", brew: "咖啡與茶", scent: "香氛保養", paper: "文具紙品", home: "居家擺設", carry: "隨身日常",
};

export interface CatalogProduct {
  id: string;
  name: string;
  maker: string;
  category: ShopCategory;
  price: number;
  compareAt?: number;
  stock: number;
  image: string;
  tags: string[];
  isNew?: boolean;
}

export const CATALOG: CatalogProduct[] = [
  { id: "t01", name: "手拉坯陶杯", maker: "鶯歌 · 土生窯", category: "table", price: 680, stock: 18, image: "photo-1514228742587-6b1558fcca3d", tags: ["handmade", "gift"] },
  { id: "t02", name: "粗陶淺盤 23cm", maker: "台南 · 白日陶作", category: "table", price: 920, compareAt: 1150, stock: 9, image: "photo-1610701596007-11502861dcfa", tags: ["handmade", "minimal"] },
  { id: "t03", name: "橄欖木砧板", maker: "義大利 · Legno", category: "table", price: 1480, stock: 4, image: "photo-1594911772125-07fc7a2d8d9f", tags: ["premium"] },
  { id: "t04", name: "玻璃水瓶 1L", maker: "日本 · 硝子工房", category: "table", price: 1080, stock: 22, image: "photo-1602143407151-7111542de6e8", tags: ["minimal"], isNew: true },

  { id: "b01", name: "衣索比亞 淺焙咖啡豆", maker: "台北 · 慢焙所", category: "brew", price: 450, stock: 40, image: "photo-1447933601403-0c6688de566e", tags: ["daily"] },
  { id: "b02", name: "手沖壺 細口 600ml", maker: "日本 · 月兔印", category: "brew", price: 1680, compareAt: 1980, stock: 7, image: "photo-1495474472287-4d71bcdd2085", tags: ["premium", "gift"] },
  { id: "b03", name: "阿里山 高山烏龍", maker: "嘉義 · 雲霧茶園", category: "brew", price: 720, stock: 25, image: "photo-1544787219-7f47ccb76574", tags: ["gift", "daily"] },
  { id: "b04", name: "拿鐵杯碟組", maker: "鶯歌 · 土生窯", category: "brew", price: 860, stock: 3, image: "photo-1509042239860-f550ce710b93", tags: ["handmade"] },

  { id: "s01", name: "木質調 大豆蠟燭", maker: "台中 · 慢火", category: "scent", price: 780, stock: 30, image: "photo-1602874801007-bd458bb1b8b6", tags: ["gift", "calm"] },
  { id: "s02", name: "檜木精油 10ml", maker: "宜蘭 · 山林所", category: "scent", price: 590, stock: 16, image: "photo-1608571423902-eed4a5ad8108", tags: ["calm", "local"] },
  { id: "s03", name: "植萃護手霜", maker: "台北 · 草本日常", category: "scent", price: 420, compareAt: 520, stock: 44, image: "photo-1556228578-8c89e6adf883", tags: ["daily", "gift"] },
  { id: "s04", name: "擴香瓶 無花果", maker: "法國 · Maison B", category: "scent", price: 1380, stock: 5, image: "photo-1600857062241-98e5dba7f214", tags: ["premium", "gift"], isNew: true },

  { id: "p01", name: "方格筆記本 A5", maker: "台北 · 紙上行", category: "paper", price: 320, stock: 60, image: "photo-1517842645767-c639042777db", tags: ["daily"] },
  { id: "p02", name: "黃銅鋼筆", maker: "德國 · Kaweco", category: "paper", price: 2280, stock: 6, image: "photo-1455390582262-044cdead277a", tags: ["premium", "gift"] },
  { id: "p03", name: "活版印刷明信片組", maker: "台北 · 日星鑄字行", category: "paper", price: 280, stock: 35, image: "photo-1586075010923-2dd4570fb338", tags: ["local", "gift"] },
  { id: "p04", name: "亞麻布面手帳", maker: "日本 · 旅人", category: "paper", price: 1280, stock: 2, image: "photo-1544816155-12df9643f363", tags: ["premium"] },

  { id: "h01", name: "陶瓷小花器", maker: "台南 · 白日陶作", category: "home", price: 540, stock: 20, image: "photo-1485955900006-10f4d324d411", tags: ["handmade", "calm"] },
  { id: "h02", name: "觀葉植物 小盆", maker: "台北 · 綠所", category: "home", price: 480, stock: 28, image: "photo-1459411552884-841db9b3cc2a", tags: ["calm", "daily"] },
  { id: "h03", name: "黃銅桌燈", maker: "丹麥 · Lys", category: "home", price: 4280, compareAt: 4980, stock: 3, image: "photo-1507473885765-e6ed057f782c", tags: ["premium"] },
  { id: "h04", name: "亞麻抱枕套", maker: "立陶宛 · Linen Co.", category: "home", price: 890, stock: 14, image: "photo-1522771739844-6a9f6d5f14af", tags: ["calm"], isNew: true },

  { id: "c01", name: "帆布托特包", maker: "台中 · 帆布行", category: "carry", price: 980, stock: 24, image: "photo-1491637639811-60e2756cc1c7", tags: ["daily", "local"] },
  { id: "c02", name: "皮革卡夾", maker: "台北 · 手縫皮事", category: "carry", price: 1180, stock: 0, image: "photo-1627123424574-724758594e93", tags: ["handmade", "gift"] },
  { id: "c03", name: "玳瑁框太陽眼鏡", maker: "日本 · 鯖江", category: "carry", price: 3680, stock: 8, image: "photo-1572635196237-14b3f281503f", tags: ["premium"] },
  { id: "c04", name: "隨行保溫杯", maker: "台灣 · 日常器", category: "carry", price: 760, compareAt: 890, stock: 33, image: "photo-1523362628745-0c100150b504", tags: ["daily"] },
];

export type ImageRatio = "portrait" | "square" | "landscape";
const RATIO: Record<ImageRatio, number> = { portrait: 5 / 4, square: 1, landscape: 9 / 16 };

// `detail` = a tighter crop of the same photo, used as the hover second image
// so every product has one without needing a second asset.
export function imageUrl(id: string, width: number, ratio: ImageRatio = "portrait", detail = false): string {
  const h = Math.round(width * RATIO[ratio]);
  const crop = detail ? "&crop=focalpoint&fp-x=.5&fp-y=.5&fp-z=1.7" : "&crop=entropy";
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&h=${h}&q=75${crop}`;
}

// A catalog product as it lives in the store: price and stock move in real
// time; `compareAt` is set only while the price is below list price.
export interface Product extends CatalogProduct {
  sold: number;
}

// Readable, stable URLs (SEO rule: no hash or query routing for pages).
export const productPath = (p: Pick<CatalogProduct, "id" | "name">) => `/p/${p.id}-${encodeURIComponent(p.name.replace(/\s+/g, "-"))}`;
export const productIdFromSlug = (slug: string) => slug.split("-")[0];
export const categoryPath = (c: ShopCategory) => `/c/${c}`;
