# 設計規格 v0(畫面動工之前)

> 狀態:第 9 節已決定;第 8 節 1–4 步(token、基本元件、商品卡、`/lab`)已完成,**等設計驗收**。
> 驗收頁:`npm run dev:web` 之後開 http://localhost:5173/lab.html
> 目前 `web/` 裡的 Mantine 版是驗證「LLM 決策 → 即時重排」的管線用的,不是設計。

## 0. 這份文件在解什麼

這個產品的 UI 不是設計師畫一次就定的 —— **每個顧客、每幾秒,版面都由 LLM 重新決定**。
所以「設計做好」的意思不是把一個畫面做漂亮,是:

1. **LLM 能選的每一個選項,都對應一個已經設計好的變體。** 模型選不出醜的組合,
   因為醜的組合根本不在選單裡。
2. **每一次改變都要看起來是故意的。** 重排、換主題、價格跳動都要有轉場,
   不能是閃一下整頁重畫。
3. **資料和版面是兩件事。** 價格和庫存每幾秒變一次(WebSocket),版面每次行為之後變一次(LLM)。
   兩者的更新都不能讓畫面跳動或重新 mount。

## 1. 參考來源與授權

| 來源 | 版本 | 授權 | 用法 |
| --- | --- | --- | --- |
| Vercel Commerce | commit 3761e52(2026-06) | **MIT** | 移植程式碼:視覺語言、卡片、購物車、商品頁 |
| Medusa Next.js Starter | commit 9818886 + `@medusajs/ui` 4.2.5、`ui-preset` 2.21.1 | **MIT** | 移植程式碼:token 系統、骨架屏、結帳流程、價格工具 |
| Shopify Horizon | 4.2.0(2025) | **僅限 Shopify 主題** | **只研究,不複製程式碼**:選項詞彙、互動模式、動態設計 |
| Shopify Dawn | — | 僅限 Shopify 主題 | 只拿來對照 Horizon 改了什麼 |

移植 MIT 程式碼時在檔頭保留來源與授權聲明。Horizon 的部分是用我們自己的話重寫行為,
只沿用「設定名稱與選項值」這層詞彙(那是設計決策,不是程式碼)。

**三者各取所長:**

- **Horizon → 決策的形狀。** Shopify 每個 section / block 都附一份設定 schema,
  幾乎全部是 enum 或有界範圍 —— 這正是 LLM 要挑的選單。Horizon 還示範了
  「**少數基本元件 + 很多具名 preset**」:一個通用 section 配十幾個預設就取代了 Dawn 一堆專用 section。
- **Medusa → 系統骨架。** CSS 變數 token(一組 light 一組 dark)、具名字級、
  用 shadow 畫邊框的 elevation、每個元件都有對應的骨架屏。
- **Vercel → 視覺語言與互動。** 中性灰階 + 單一強調色、藥丸形按鈕、
  壓在圖上的毛玻璃價格標籤、hover 放大、樂觀更新購物車。

## 2. 技術選型的調整(**需要你決定**,見第 9 節)

兩個 MIT 範本都是 **Tailwind**。要忠實移植,建議:

- **Tailwind 4 + Headless UI**(Vercel 用的)取代 Mantine。Mantine 的元件有自己的外觀,
  跟移植來的設計會打架;Tailwind + 無外觀元件庫才能讓 token 系統成為唯一的外觀來源。
- **React Router**(商品頁、分類頁要有網址)。
- **字型打包進來**(`@fontsource-variable/*`),不依賴外部 CDN。

## 3. 設計 token

### 3.1 顏色:角色,不是色碼

LLM **永遠不給 hex**。它選一組 palette preset,再替每個 section 選一個 surface;
文字色、hover 色、對比都由程式算。

- **角色變數**(Medusa 的命名):`--fg-base / --fg-subtle / --fg-muted / --fg-interactive`、
  `--bg-base / --bg-subtle / --bg-component`、`--border-base / --border-strong`、
  `--button-primary(-hover/-pressed)`、`--button-neutral(…)`、
  徽章 `--tag-{neutral,accent,success,warning,danger}-{bg,border,text}`。
- **surface**(Horizon 的思路):每個 section 選 `page | subtle | inverse | accent`。
  文字色自動取對比較好的那一端;深色底時把半透明輔助色的不透明度調高
  (Horizon 是 5→15%、10→25%、35→55%)。
- **hover 色由基底色推算**(Horizon 的規則:依亮度調亮或調暗一小階),不另外存。
- **語意色固定、不給 LLM 改**:錯誤、成功、有貨 / 少量 / 缺貨、降價、漲價。
- Vercel 把 `blue-600` 寫死在約 10 處 —— **移植時全部換成 `--accent`**。

palette preset(6 組,各有 light + dark,定義在 `web/src/ds/theme/palettes.ts`):
`ink` 墨(黑白灰 + 藍)、`sand` 砂(米白 + 赤陶)、`sage` 苔(鼠尾草綠)、
`blush` 胭(粉 + 梅)、`night` 夜(炭 + 琥珀)、`oat` 穀(燕麥 + 橄欖)。

**對比是程式保證的**:`derive.ts` 算出每個角色色之後,低於門檻的會被往黑或白推到及格為止
(文字 ≥ 4.5、強調色當細線 ≥ 3)。`npm run check:contrast` 會檢查 6 組 × 亮暗 × 4 種底色
的全部組合,改 palette 之後要跑。

### 3.2 字體

- **四個角色**:body / subheading / heading / accent(Horizon)。
- **LLM 選一組字體搭配**(全部用 `@fontsource` 打包,不靠 CDN):
  `modern`(Geist + 思源黑體)、`editorial`(Fraunces + 思源宋體 標題)、
  `friendly`(粉圓 標題)、`literary`(霞鶩文楷 標題)。內文一律思源黑體。
  原本的 `technical` 換成 `literary` —— 選物店用得到手寫感,用不到等寬字。
- **中文字型要 import 字重檔(`400.css`),不是 `chinese-traditional-400.css`**:
  後者只有一小段字,其餘字會靜靜地退回預設字體。
- **字級**:沿用 Medusa 的具名字級(`txt-small / txt-medium / txt-large…`、`-plus` = 500)。
  標題用 Horizon 的流體縮放:≥48px 的字級會隨視窗縮小,但**永遠不小於下一級**。
- **LLM 可調**:`headingCase: none | uppercase`、`scale: compact | normal | display`。

### 3.3 形狀、間距、陰影、動態

| token | LLM 看到的選項 | 程式裡對應 |
| --- | --- | --- |
| radius | `sharp | soft | round | pill` | 卡片 0/6/12/16px,按鈕 0/6/12/9999px |
| density | `tight | normal | airy` | 間距比例 + 格線欄寬 |
| pageWidth | `narrow | normal | wide` | 90 / 120 / 150rem(Horizon) |
| elevation | `flat | soft` | 無陰影 / Medusa 的 card-rest + card-hover |
| hoverEffect | `none | lift | scale | zoom` | 上浮 4px / 放大 1.03 / 只放大圖 1.015(Horizon) |

動態(Horizon):預設 **125ms**、抽屜 200ms,彈性曲線 `(.34,1.56,.64,1)`,
spring 用 CSS `linear()`。**所有效果都尊重 `prefers-reduced-motion`**,
hover 效果只在精確指標裝置(滑鼠)上生效。

## 4. 元件清單

符號:**V** = 從 Vercel 移植、**M** = 從 Medusa 移植、**H** = 依 Horizon 模式自己寫、**新** = 我們獨有。

### 4.1 基本元件
| 元件 | 來源 | 備註 |
| --- | --- | --- |
| Button(primary / secondary / ghost / danger × 4 尺寸) | M | cva 配方;loading 時疊一層 spinner |
| Badge(tone × size × shape) | M | 直接對應 LLM 的徽章選項 |
| Price | V + M | narrowSymbol;原價刪除線 + `-N%`;**新增:數字變動時閃綠 / 閃紅** |
| Stock | H | 有貨綠點 / 少量橘點「只剩 N 件」/ 缺貨灰 |
| Skeleton | M | **全站只有一種**:`bg-component animate-pulse` |
| Input(浮動標籤)、Select、Radio 卡片、Accordion(+ 號變 − 號) | M | |
| Drawer / Modal | V | Headless UI Dialog;遮罩淡入 + 面板滑入 |
| Money shimmer | H | 總額重算中時,數字上跑一道漸層光,取代 spinner |

### 4.2 商品卡(整個系統最重要的元件)

結構(Horizon 的積木概念,但用 props 而非 block tree):

```
ProductCard
├─ Media         image_ratio · hover 行為 · 徽章 · 快速加入
├─ Info          stacked(標題 / 價格上下)或 row(標題左、價格右)
│  ├─ Title
│  ├─ Price
│  └─ Stock(可選)
└─ Swatches(可選)
```

| 選項 | 值 | 來源 |
| --- | --- | --- |
| `imageRatio` | `portrait(4/5) | square | landscape(16/9)` | H |
| `hover` | `none | second_image | zoom` | H / V |
| `quickAdd` | `on | off` | H(圓鈕,hover 淡入、展開成文字) |
| `info` | `stacked | row | overlay` | H / **V 的毛玻璃價格標籤 = overlay** |
| `badgePosition` | `top-left | top-right | bottom-left` | H |
| `frame` | `bare | card` | V(白底 + 邊框)/ M(淺灰底 + 陰影) |

- **徽章優先順序寫死在程式裡,不給 LLM**(Horizon 的規則):
  售完 > 降價 > 少量 > LLM 的推薦徽章。一張卡只掛一個。
- **徽章的內縮距離跟著卡片圓角算**,圓角再大徽章也不會撞到角(Horizon 的公式)。
- **沒有圖片時**:淡色底 + 大字商品名(Horizon),不放破圖。

### 4.3 版面區塊(LLM 決定順序與選項)

| 區塊 | preset / 選項 | 來源 |
| --- | --- | --- |
| **Announcement** | 輪播訊息;速度 | H |
| **Header** | logo `left|center`;sticky `always|scroll-up|never`;首頁透明疊在 hero 上 | H |
| **Hero** | `split`(圖文左右)、`overlay`(文字壓圖)、`bento`(V 的 1 大 2 小)、`minimal`(M 的純文字);高度 `small|medium|large|full` | H / V / M |
| **ProductRail** | `grid | carousel | editorial`;欄數;數量 | H / V / M |
| **Marquee** | 方向;hover 減速 | V + H(修好 V 失效的動畫) |
| **MediaWithContent** | 圖在 `left|right`;寬度 `narrow|medium|wide` | H |
| **CollectionTiles** | `grid | bento`;文字在圖上 / 圖下 | H |
| **PromoBanner**(新) | 限時降價倒數、免運進度 | 新 + M 的免運提示 |
| **LiveTicker**(新) | 「有人剛買了…」即時動態 | 新 |
| **Footer** | 深色反轉;電子報 | H / V |

每個區塊都要有 **surface**(3.1)和 **一個對應的骨架屏**。

### 4.4 頁面

| 頁面 | 結構 | 來源 |
| --- | --- | --- |
| 首頁 | Announcement → Header → LLM 決定的區塊序列 → Footer | |
| 分類 / 搜尋 | 篩選 `sidebar | top-bar`;卡片大小 `small|medium|large`;顧客可切換密度 | V 的三欄 + H 的篩選列 |
| 商品頁 | 圖庫 `grid | carousel(縮圖在左 / 下)`;資訊欄 sticky;規格選擇 `buttons | swatches`;手機版黏底加購列 | M 三欄 sticky + V 圖庫 + H 選項 |
| 購物車 | 抽屜(預設)或整頁;樂觀更新;品項收合 / 展開動畫 | V + H |
| 結帳 | 步驟在網址上;完成的步驟收成唯讀摘要 + 編輯 | M |

## 5. 決策 schema v2(取代現在的 `shared/decision.ts`)

原則(Horizon 的教訓):

1. **LLM 選 preset,不選數字。** flex、gap、padding 等數值留在程式裡。
2. **LLM 選角色,不選顏色。** 對比與 hover 由程式算。
3. **會影響正確性的邏輯不給 LLM**:徽章優先順序、庫存門檻、能不能加購。

```ts
Decision = {
  theme: {
    palette: "mono" | "warm" | "fresh" | "playful" | "night" | "earth",
    scheme: "light" | "dark",
    fonts: "modern" | "editorial" | "friendly" | "technical",
    typeScale: "compact" | "normal" | "display",
    headingCase: "none" | "uppercase",
    radius: "sharp" | "soft" | "round" | "pill",
    density: "tight" | "normal" | "airy",
    pageWidth: "narrow" | "normal" | "wide",
    hoverEffect: "none" | "lift" | "scale" | "zoom",
  },
  card: { imageRatio, hover, quickAdd, info, badgePosition, frame },   // 全站一致
  header: { logo: "left" | "center", sticky: "always" | "scroll-up", announcement: MessageKey | "none" },
  sections: Array<
    | { type: "hero",    preset: "split" | "overlay" | "bento" | "minimal", height, surface, productIds }
    | { type: "rail",    preset: "grid" | "carousel" | "editorial", columns: 3 | 4 | 5, surface, intent: SectionIntent, productIds }
    | { type: "marquee", direction, surface, productIds }
    | { type: "media",   side: "left" | "right", width, surface, productIds, intent }
    | { type: "tiles",   preset: "grid" | "bento", surface, categories }
    | { type: "promo",   kind: "flash_sale" | "free_shipping", surface }
    | { type: "ticker",  surface }
  >,
  highlights: Array<{ productId, badge: "for_you" | "trending" | "new" }>,   // 只有推薦類徽章
  signals: Signal[],
}
```

`SectionIntent`(= 現在的 `for_you / deals / low_stock / gift_ideas…`)決定區塊標題,
文字仍然在 `copy.ts`。

## 6. 即時更新與轉場(UI / UX 連動的核心)

| 什麼在變 | 多久一次 | 怎麼呈現 |
| --- | --- | --- |
| 價格 | 幾秒 | Price 閃綠 / 閃紅 0.8s;原價刪除線淡入 |
| 庫存 | 幾秒 | Stock 數字滾動;歸零時卡片淡成灰、徽章換成「售完」 |
| 版面(LLM) | 每次行為 | **View Transition**:只替畫面內看得到的卡片命名,讓它們飛到新位置;看不到的不命名(效能) |
| 主題(LLM) | 偶爾 | CSS 變數 300ms 過場;**不重新 mount 任何元件** |
| 購物車 | 使用者操作 | 樂觀更新;品項收合 / 展開;總額 shimmer;加入時縮圖飛向購物車 |
| LLM 思考中 | 1–5 秒 | **舊版面保持可用**,不放骨架屏;角落顯示「正在為你重新安排」 |

規則:

- **section 的 key 用 `type + intent` 或 `productId`,不能用 index 或時間戳。**
  現在的實作用 `decidedAt` 當 key,每次重新決策都會整個重新 mount —— 這要改掉。
- **骨架屏只用在第一次載入。** 之後一律「舊資料 + 停用狀態」(Medusa 商品頁的做法)。
- **加購物車的回饋:** 購物車開幾秒、圖示跳一下、縮圖飛過去。
  **但由 WebSocket 推來的購物車變化不自動打開抽屜**(Vercel 沒防到這點)。

## 7. 移植時不能照搬的 bug

**Vercel**

- 三個動畫的 keyframes 在升 Tailwind 4 時遺失,class 有寫但不會動:`animate-carousel`、`animate-fadeIn`、`animate-blink`
- Geist 字型沒有真的套上
- `useOptimistic` 放在 hook 裡:每個呼叫的元件各有一份樂觀狀態,購物車圖示不會即時更新。
  **要把 reducer 搬進 provider**
- 在 render 裡原地 sort `cart.lines`;搜尋框的 `w-max-[550px]` 是錯字

**Medusa**

- 一堆不存在的 class(`txt-compact-plus`、`shadow-brders-none` 等)
- 骨架屏卡片比例 9/16,真的精選卡片是 11/14,載入完會跳
- 沒選規格時按鈕寫「缺貨」而不是「請選擇規格」
- 硬寫的灰色讓深色模式只做了一半
- `small:` 斷點是 ≥1024px,不是 Tailwind 預設,直接貼過來會全部跑版

## 8. 建構順序

1. token(`tokens.css` + 6 組 palette × light/dark)、字型、Tailwind 設定
2. 基本元件
3. 商品卡 × 所有選項組合
4. **`/lab` 頁面:列出每個元件的每個變體**,切換 palette / 字體 / 圓角 / 密度即時預覽。
   這頁是設計驗收的地方 —— 在這裡看起來不對,就不進商店
5. 版面區塊 + 對應骨架屏
6. 決策 schema v2 + 兩個決策引擎改寫
7. 頁面(首頁 → 商品頁 → 購物車 → 分類 → 結帳)
8. 轉場與即時更新

## 9. 已決定(2026-09-24)

- UI 庫:**換成 Tailwind 4 + Headless UI**。舊的 Mantine 版暫時留在 `index.html`,
  新設計系統在 `web/src/ds/`,由 `lab.html` 驗收;頁面移植(第 7 步)時再拆掉 Mantine
- 商品圖:**免費圖庫(Unsplash)**。id 是憑記憶挑的,建置環境連不到 Unsplash 無法驗證 ——
  `/lab` 的「圖片」區會列出實際載入失敗的;失敗時卡片自動換成文字底圖
- 品牌:**生活選物店**。目錄改成 6 類 24 件(`shared/catalog.ts`):
  餐桌器皿、咖啡與茶、香氛保養、文具紙品、居家擺設、隨身日常
- 決策引擎(2026-09-25):**優先用 TypeSafe 的 Jev**(`server/decision/typesafe.ts`),其次 Claude,最後規則引擎。
  Jev 只回答有型別的問題(單選 / 是非),產生不出區塊與商品 id 清單,所以分工:
  Jev 逐欄選風格 enum(店型、配色、字型、圓角、密度、卡片、標頭、首屏、分類頁、商品頁),
  並對每件商品回「想不想看」的機率;區塊與商品排序仍由規則引擎做,Jev 的機率加進商品分數。
  風格欄位**不綁店型**、星座算正式依據,所以組合比四種預設多;信心低於 0.4 的欄位退回店型預設

### 原本的問題(留作紀錄)

1. **換掉 Mantine,改用 Tailwind 4 + Headless UI?**(建議:是,理由見第 2 節)
2. **商品圖片從哪來?** 現在是 emoji,撐不起任何電商設計。
   - (a)用 Unsplash 之類的免費圖庫(要選好授權,瀏覽器端載入)
   - (b)用 AI 生成一批商品圖放進 repo
   - (c)你提供真的商品資料
3. **品牌感**:這家店是賣什麼的?現在的 36 件商品跨 6 個分類,像百貨。
   如果收斂成一個主題(例如生活選物店),palette 和字體 preset 可以做得更有個性。

## 10. SEO(demo 不實作,但要有解)

現在是純 Vite SPA,搜尋引擎只拿到空的 `<div id="root">`。上線時的解法:

1. **分兩層**。可索引的是商品頁、分類頁、價格庫存 —— 對所有人都一樣,由伺服器渲染。
   LLM 個人化的是首頁排序、推薦、主題 —— 不需要被索引。
2. **爬蟲看到的是「新訪客版」**:規則引擎的預設決策。內容與真人新訪客一致,只是排序不同,
   不構成 cloaking;爬蟲也不觸發 LLM 呼叫。
3. **商品頁**:固定網址、`Product` + `Offer` JSON-LD(價格、`InStock`/`OutOfStock`)、
   canonical、sitemap、OG。JSON-LD 的價格必須等於畫面上的價格,SSR 快取要短。
4. **Core Web Vitals(CLS)**:LLM 決策完才重排會被算成版面位移。解法:回訪者用上一次的
   決策做伺服器渲染;新決策在下一次換頁時生效,或只改動首屏以下 / 預留空間的區域。
5. **遷移路徑**:Next.js App Router(Vercel Commerce、Medusa 原本就是 Next.js)。
   設計系統是純 React + Tailwind,不用改。

**demo 階段先守住三條,讓將來改 SSR 的成本最低:**

- 商品與分類用**固定、可讀的網址**(`/p/<slug>-<id>`、`/c/<category>`),不用 hash 或 query 表示頁面
- 元件在 render 階段**不碰 `window` / `localStorage`**(只在 effect 裡),將來可直接伺服器渲染
- 版面重排遵守第 6 節:不打斷正在看的畫面,不造成自發位移
