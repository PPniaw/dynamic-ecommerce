# 即時商店(LLM 決策電商 demo)

一個「商店會自己重新排版」的電商 demo:**LLM 只做決策,不寫文字**。

每當顧客瀏覽、收藏、加購物車、結帳、改喜好,或市場上有商品售完 / 降價,
後端就把「這位顧客的輪廓 + 即時商品目錄」交給 Claude,拿回一份**決策**:

| 決策欄位   | 內容                                                      |
| ---------- | --------------------------------------------------------- |
| `theme`    | 主色、深淺色、圓角、密度、字體 → 整個 UI 的風格即時切換     |
| `hero`     | 首頁主打哪一件,以及理由(降價 / 最後幾件 / 送禮…)        |
| `sections` | 要出現哪些區塊、順序、每區用什麼版型(grid / carousel / list) |
| `badges`   | 哪些商品掛「熱賣 / 降價 / 少量 / 推薦」                     |
| `signals`  | 做這個決策的理由代碼(右側「決策引擎」面板會顯示)           |

全部是 enum 或商品 id,用 structured outputs 強制 schema。畫面上所有字都在
`web/src/copy.ts`,模型碰不到 —— 所以它不會寫出錯的價格或不存在的承諾。

## 技術棧

- **前端**:React 19 + Vite + **Mantine 9**(UI 庫,theme 由決策即時產生)
- **後端**:Node 22 + Express + WebSocket(`ws`)
- **資料庫**:SQLite(Node 內建 `node:sqlite`,免編譯,檔案在 `data/shop.db`)
- **決策**:Claude(`@anthropic-ai/sdk`),沒有 API key 時自動改用規則引擎,輸出格式相同

## 跑起來

```bash
npm install
cp .env.example .env        # 填 ANTHROPIC_API_KEY(可不填)
export $(grep -v '^#' .env | xargs)
npm run dev                 # http://localhost:5173
```

API key 要從 Anthropic Console(https://console.anthropic.com → API Keys)建立。

## 即時的部分

- **市場模擬器**(`server/index.ts` 的 `marketTick`):每 2.5 秒模擬其他顧客下單、補貨、閃購調價,
  透過 WebSocket 推給所有人。卡片會閃一下,右側「即時動態」會出現紀錄
- **購物車價格是活的**:加入後降價 / 漲價會標出來,結帳以當下價格計算
- **搶最後一件**:結帳在一個 transaction 裡檢查並扣庫存,兩人同時搶只有一人成功
- **重新決策的節流**:每位顧客同時最多一個決策在跑;連續點擊會合併成一次(900ms debounce);
  跑的途中又有新動作,結束後只再跑一次。市場事件觸發的重新決策每人每 20 秒最多一次(控制成本)
- **首屏不等 AI**:連上時先用規則引擎立刻出畫面,Claude 的決策回來後再替換

## 用戶喜好與需求

右上「喜好」:風格(交給 AI / 極簡 / 繽紛 / 暗色)、分類、預算、以及一段自由文字的**需求**
(例如「下個月要去合歡山露營」)。需求是**輸入**給模型的;輸出仍然只是 enum。
下半部顯示從行為推算出的分類偏好(加權 + 10 分鐘半衰期)。

內建三個顧客:極簡上班族、週末山友、送禮苦手 —— 切換就能看到三種完全不同的商店。

## 檔案地圖

```
shared/decision.ts        決策 schema(前後端共用,Zod)
server/decision/claude.ts Claude 決策(structured outputs + server-side fallback)
server/decision/rules.ts  規則引擎(無 key / 出錯 / 首屏)
server/decision/index.ts  選引擎 + sanitize(過濾不存在或售完的商品 id)
server/profile.ts         事件 → 偏好輪廓
server/db.ts              SQLite schema 與所有 SQL
server/index.ts           REST + WebSocket + 市場模擬 + 決策排程
web/src/                  React + Mantine
```

## 刻意的取捨

- **effort 預設 `low`**:這個呼叫在每個動作後都會跑,延遲比深度重要。覺得決策太淺就設 `SHOP_CLAUDE_EFFORT=medium`
- **不用 SDK 的 `betaZodOutputFormat`**:它的 schema 轉換會把 `enum` 降級成描述文字,enum 就不再是硬限制。
  改送 Zod 原生的 JSON Schema,回來再用同一個 Zod schema 驗證
- **沒有登入**:demo 用選單切換顧客;要上線得加驗證(目前任何人都能改任何 userId 的購物車)
- **付款是模擬的**
