# dynamic-ecommerce(日常所)

會依顧客個性改變的電商 demo。**LLM 只做決策,不寫文字**:它讀顧客的個性(MBTI、星座、
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

決策引擎依 key 決定:`TYPESAFE_API_KEY` → jev(TypeSafe AI),否則 `ANTHROPIC_API_KEY` → Claude,
都沒有就用規則引擎(輸出格式相同);`SHOP_DECISION_ENGINE=jev|claude|rules` 可強制指定。
**目前兩把 key 都沒有,jev 和 Claude 兩條路都只對 mock 驗過。**
環境變數用 `SHOP_CLAUDE_MODEL` / `SHOP_CLAUDE_EFFORT` —— 不要改回 `CLAUDE_*`,
雲端環境本身就設了 `CLAUDE_EFFORT`,會蓋掉我們的值(踩過)。

## 結構

- `shared/` —— 前後端共用:`decision.ts`(schema v2)、`archetypes.ts`(四種店型預設 + 個性評分)、
  `personas.ts`、`catalog.ts`(24 件、6 類、Unsplash 圖)、`profile.ts`(事件 → 偏好,純函式)
- `server/` —— Express + ws + `node:sqlite`(`data/shop-v2.db`)、市場模擬、決策排程、
  `decision/rules.ts`(規則引擎)、`decision/jev.ts`、`decision/claude.ts`、`decision/index.ts`(選引擎 + sanitize)、`decision/limits.ts`
- `web/src/ds/` —— 設計系統:token(`tokens.css`、`theme/`)、基本元件、商品卡
- `web/src/store/` —— 商店:`sections/`、`cards/`、`pages/`,各有四種店型的變體;`copy.ts` 是所有文字
- `web/src/store/static/engine.ts` —— 瀏覽器內的後端,給發布的預覽頁用(`VITE_STATIC=1`)

## 紀律(每一條都有原因,別隨手改回去)

- **LLM 輸出只有 enum 和商品 id**。文字全在 `web/src/store/copy.ts`,依店型換語氣。
- **會影響正確性的東西不交給 LLM**:售完 / 特價 / 少量徽章、庫存門檻、能不能加購都由程式算。
- **jev 只回答題目,不產生 JSON**:它判斷店型、深淺色、標語、送禮、每件商品的喜好機率,
  版面由 `decideWithRules(input, hints)` 組。**不裝 `@typesafe-ai/sdk`**,直接打 `POST /v1/systemone`
  (Bearer key),環境變數名稱沿用官方 SDK 的 `TYPESAFE_*`。
- **Claude 呼叫不用 SDK 的 `betaZodOutputFormat`**:它會把 enum 降成描述文字。用 `z.toJSONSchema`。
- **顏色只從 5 個種子色推算**,`derive.ts` 會把不及格的角色色推到 WCAG AA。LLM 選 palette 和 surface,不選色碼。
- **`text-base` 在 Tailwind 是字級,不是顏色**。要用底色當文字色寫 `text-(--bg-base)`。
- **中文字型 import 字重檔**(`@fontsource/.../400.css`),不是 `chinese-traditional-*.css`(只有一小段字)。
- **版面不打斷正在看的頁面**:瀏覽觸發的重新決策等換頁才套用;改資料 / 換顧客才立刻套用。
- **View transition 有 300ms 保險**(`StoreContext.tsx` 的 `withTransition`):Chromium 曾把更新卡到 4 秒。
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

再把產出的 css / js 內嵌成單一 HTML(加 Google Fonts `<link>`)發布。已發布:
- 商店:https://claude.ai/artifact/9k4dAKmMaEgZ4DEsrdAqY9
- 設計實驗室:https://claude.ai/artifact/PbyncmSsLXgcNqGYpBUiP8

## 還沒驗證 / 待辦

- **jev 實際決策**:沒有 key,雲端環境也連不到 `api.typesafe.ai`(要在網路設定放行)。
  API 格式是照官方 SDK 0.6.0 的原始碼寫的;一次問 4 + 有庫存商品數(約 28)題,題數上限、延遲未知。
- **Claude 實際決策**:沒有 API key,品質與延遲未知(預設 `claude-opus-5`、effort `low`、server-side fallback 開)。
- **商品圖**:Unsplash id 憑記憶挑的,建置環境連不到圖庫。本機跑 `/lab.html` 的「圖片」區會列出失敗的。
- **沒有登入**;付款是模擬的。
