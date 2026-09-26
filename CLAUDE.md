# dynamic-ecommerce(日常所)

會依顧客個性、行為和聊天內容改變的電商 demo。**LLM 只做決策,不寫文字**(唯一例外是聊天的回話,見下):它讀顧客的個性(MBTI、星座、
個性標籤、興趣)、需求、行為與即時庫存,先選四種店型之一(雜誌 editorial / 拼貼 collage /
索引 index / 特賣 deal),再決定主題、標頭、首屏、區塊、卡片、分類頁與商品頁的版型。

完整設計在 `docs/design-spec.md`(兩邊不一致時以它為準)。README 有使用說明。

## 跑起來

需要 **Node 22.5+**(資料庫用內建的 `node:sqlite`;Node 20 沒有)。專案根目錄有 `.nvmrc`。
Port:API 8787、Vite 5173 —— 跟同一台機器上的 Pik(8081)、sticker-lab(8082)不衝突。

```bash
nvm use                  # 讀 .nvmrc → Node 22
npm install
npm run dev              # API :8787 + Vite :5173(/ 是商店,/lab.html 是設計實驗室)
npm run typecheck
npm run check:contrast   # 改 palettes.ts / derive.ts 之後必跑
```

決策引擎的優先順序:`TYPESAFE_API_KEY`(TypeSafe Jev)> `ANTHROPIC_API_KEY`(Claude)> 規則引擎,輸出格式都一樣。
雲端環境已設 `TYPESAFE_API_KEY` 並允許 `api.typesafe.ai`;**Claude 那條路還沒有 key,只對 mock 驗過。**
TypeSafe 的文件站在這個環境連不到,SDK 的 README 與型別(`node_modules/@typesafe-ai/sdk/dist/index.d.mts`)就是文件。
環境變數用 `SHOP_CLAUDE_MODEL` / `SHOP_CLAUDE_EFFORT` —— 不要改回 `CLAUDE_*`,
雲端環境本身就設了 `CLAUDE_EFFORT`,會蓋掉我們的值(踩過)。

## 結構

- `shared/` —— 前後端共用:`infer.ts`(行為 → 猜個性)、`chat.ts`(對話 → 偏好更新、關鍵字讀法、Claude prompt)、`decision.ts`(schema v2)、`archetypes.ts`(四種店型預設 + 個性評分)、
  `personas.ts`、`catalog.ts`(24 件、6 類、Unsplash 圖)、`profile.ts`(事件 → 偏好,純函式)
- `server/` —— Express + ws + `node:sqlite`(`data/shop-v2.db`)、市場模擬、決策排程、
  `decision/rules.ts`(規則引擎)、`decision/typesafe.ts`、`decision/claude.ts`、`decision/index.ts`(sanitize)、`decision/limits.ts`
- `web/src/ds/` —— 設計系統:token(`tokens.css`、`theme/`)、基本元件、商品卡
- `web/src/store/` —— 商店:`sections/`、`cards/`、`pages/`,各有四種店型的變體;`copy.ts` 是所有文字;`ChatDock.tsx` 是聊天
- `web/src/store/static/engine.ts` —— 瀏覽器內的後端,給發布的預覽頁用(`VITE_STATIC=1`)

## 紀律(每一條都有原因,別隨手改回去)

- **LLM 輸出只有 enum 和商品 id**。文字全在 `web/src/store/copy.ts`,依店型換語氣。
- **會影響正確性的東西不交給 LLM**:售完 / 特價 / 少量徽章、庫存門檻、能不能加購都由程式算。
- **Jev 只回答單題(單選 / 是非),寫不出清單**:它選風格 enum、給每件商品「想不想看」的機率;
  區塊和商品排序交給 `decideWithRules(input, hints)`。風格欄位刻意不綁店型、星座算正式依據(要的是變化大);
  信心低於 `SHOP_TYPESAFE_MIN_CONFIDENCE`(預設 0.4)的欄位退回店型預設。有送禮需求時標題固定 `gift_season`。
- **聊天**:顧客的話先變成 `ChatUpdate`(只有 enum、預算數字、一句需求),寫進 prefs,店面**立刻**重排
  (trigger `chat`,和 `prefs` 一樣不等換頁)。讀法:Claude(server 有 key,或預覽頁的 `sample`)> Jev > 關鍵字。
  **回話是唯一讓 LLM 寫給顧客看的文字**:prompt 禁止提價格、折扣、庫存;價格和庫存由回話下的商品卡從即時資料顯示。
  沒有 AI 回話時(`reply: null`)前端用 `copy.ts` 的 `CHAT_COPY` 依店型回。
- **從行為猜個性**(`shared/infer.ts`):瀏覽類觸發、至少 4 個事件、每 15 秒且新增 3 個事件才跑一次。
  行為先整理成白話觀察句(Jev 讀原始數字很差),每個可猜的個性問一題、附上「是 / 不是」的依據;
  **Jev 60% + 規則 40% 加權**(Jev 單獨時對每個人都偏向「重設計」)。≥ 0.75 加入、< 0.35 撤掉。
  猜的記在 `persona.inferred`(面板虛線、標「猜」,並跳提示);顧客點掉的進 `persona.rejected`,不再猜;
  顧客自己說的(面板或聊天)不算猜。內向 / 外向 / 感性 / 理性不從行為猜。預覽頁只用規則。
- **Claude 呼叫不用 SDK 的 `betaZodOutputFormat`**:它會把 enum 降成描述文字。用 `z.toJSONSchema`。
- **顏色只從 5 個種子色推算**,`derive.ts` 會把不及格的角色色推到 WCAG AA。LLM 選 palette 和 surface,不選色碼。
- **`text-base` 在 Tailwind 是字級,不是顏色**。要用底色當文字色寫 `text-(--bg-base)`。
- **中文字型 import 字重檔**(`@fontsource/.../400.css`),不是 `chinese-traditional-*.css`(只有一小段字)。
- **版面不打斷正在看的頁面**:瀏覽觸發的重新決策等換頁才套用;改資料 / 換顧客才立刻套用。
- **換版一律用粒子重組**(`web/src/ds/fx/particleMorph.ts`,`withTransition` 呼叫它):讀 `[data-morph]` 裡的文字、圖片、
  色塊變成粒子(細小半透明圓點、輕微弧線),舊頁淡出 260ms 後**一定**套用更新,粒子飄到新位置、新頁淡入,約 1.6 秒。通用、不綁任何元件;
  動畫只是覆蓋層,有保險 timeout,頁面不會卡在隱藏。已不用 View Transition(Chromium 曾把更新卡到 4 秒)。
  `prefers-reduced-motion` 時直接換。
- **`static/engine.ts` 是 server 的鏡像,不是分支**:改 server 的排程、市場模擬或 API 形狀時同步改它。
  決策直接 import `server/decision/rules.ts`,偏好直接用 `shared/profile.ts`。
- **Section 的 React key 用 `kind-intent`**,不要用 index 或時間戳(會整段重新 mount)。
- **SEO(demo 不實作)**:固定可讀網址 `/p/<id>-<name>`、`/c/<category>`;元件 render 時不碰 `window` / `localStorage`。
- **授權**:Vercel Commerce、Medusa 是 MIT,可移植(檔頭保留來源);Shopify Horizon / Dawn 只限 Shopify
  主題使用 —— **只參考結構與模式,不複製程式碼**。

## 預覽頁(Artifact)

發布的頁面不能載外部圖片、只能從 Google Fonts 載字型,所以有獨立的 preview build:

```bash
PREVIEW_ENTRY=web/store-preview.html PREVIEW_OUT=<dir> npx vite build --config vite.preview.config.ts   # 商店
PREVIEW_OUT=<dir> npx vite build --config vite.preview.config.ts                                       # /lab
```

再把產出的 css / js 內嵌成單一 HTML(加 Google Fonts `<link>`)發布。
商店預覽頁宣告了 `sample` capability:聊天用**觀看者自己的 claude.ai 訂閱**呼叫 Claude(不用 API key,第一次會問同意);
重新發布時不帶 `capabilities` 會沿用,帶了就要包含 `{"sample": {}}`。本機或非 claude.ai 環境 `sample` 不存在,自動改用關鍵字。已發布:
- 商店:https://claude.ai/artifact/9k4dAKmMaEgZ4DEsrdAqY9
- 設計實驗室:https://claude.ai/artifact/PbyncmSsLXgcNqGYpBUiP8

## 還沒驗證 / 待辦

- **Claude 實際決策**:沒有 API key,品質與延遲未知(預設 `claude-opus-5`、effort `low`、server-side fallback 開)。
- **Jev**:實測一次請求約 0.25–0.4 秒(約 25 題風格 + 每件商品一題)。店型對四位種子顧客都對;
  「INFP 但急著送禮比價」仍選 editorial(規則引擎也是),要不要讓需求壓過個性還沒定。
  混搭組合(例如索引店配粉色、貼紙卡)沒有在瀏覽器裡逐一看過。
- **商品圖**:Unsplash id 憑記憶挑的,建置環境連不到圖庫。本機跑 `/lab.html` 的「圖片」區會列出失敗的。
- **聊天**:預覽頁的 Claude 路徑只用假的 `sample` 在 Playwright 驗過資料流;真的在 claude.ai 上的回話品質與延遲還沒看。
  server 的 Claude 聊天路徑沒有 key,沒跑過。
- **猜個性**:只用兩種模擬逛法(專看特價 + 秒加購物車、慢慢看禮品手作)調過;門檻和權重還很粗。
- **沒有登入**;付款是模擬的。
