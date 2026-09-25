# 日常所 · 會依個性改變的電商 demo

一個「不同的人走進不同的店」的電商 demo:**LLM 只做決策,不寫文字**。

LLM 讀顧客的個性(MBTI、星座、個性標籤、興趣)、需求、瀏覽行為與即時庫存,
從四種**結構完全不同**的店裡選一種,再決定這家店的每個細節:

| 店型 | 適合 | 長什麼樣 |
| --- | --- | --- |
| **雜誌** editorial | 慢活、感性、愛讀故事的人 | 大圖跨頁、製作者故事、襯線大字、大量留白 |
| **拼貼** collage | 好奇、衝動、愛冒險的人 | 歪斜的貼紙卡、跑馬燈、便當盒格線、圓體 |
| **索引** index | 理性、比較規格的人 | 規格表、編號索引、銳角、高資訊密度 |
| **特賣** deal | 務實、比價、趕時間的人 | 倒數計時、大價格、庫存條、密集格線 |

店型之下,LLM 還決定:主題(配色、字體、圓角、密度)、標頭、首屏、區塊順序與版型、
卡片樣式、分類頁與商品頁的版型、推薦徽章。全部是 enum 或商品 id,用 structured outputs
強制 schema(`shared/decision.ts`)。畫面上所有字在 `web/src/store/copy.ts`,依店型換語氣。

內建五位示範顧客:Ines(INFP · 雙魚)、Leo(ENFP · 射手)、Ada(INTJ · 摩羯)、
Ken(ESTJ · 處女)、新訪客。左下角「你是誰?」可以切換,或自己描述個性,店會即時重排。

## 技術棧

- **前端**:React 19 + Vite + **Tailwind 4 + Headless UI**,自建設計系統(`web/src/ds/`,驗收頁 `/lab.html`)
- **後端**:Node 22 + Express + WebSocket(`ws`)
- **資料庫**:SQLite(Node 內建 `node:sqlite`,免編譯,檔案在 `data/shop-v2.db`)
- **決策**:jev(TypeSafe AI,直接打 HTTP API)或 Claude(`@anthropic-ai/sdk`),都沒有 key 時自動改用規則引擎,輸出格式相同

## 跑起來

需要 Node 22.5+(`node:sqlite`)。有 nvm 的話先 `nvm use`。

```bash
npm install
cp .env.example .env        # 填 TYPESAFE_API_KEY 或 ANTHROPIC_API_KEY(都可不填)
export $(grep -v '^#' .env | xargs)
npm run dev                 # http://localhost:5173
```

jev 的 key 從 TypeSafe AI 取得(文件:https://docs.typesafe.ai),Claude 的 key 從 Anthropic Console
(https://console.anthropic.com → API Keys)建立。兩個都設時預設用 jev,可用 `SHOP_DECISION_ENGINE=jev|claude|rules` 指定。

### jev 怎麼做決策

jev 不產生 JSON,只回答「選擇題 / 是非題 / 評分題」並附機率。所以一次呼叫問它:
店型(四選一)、亮色或暗色、首屏標語、是不是在找禮物,以及每件有庫存的商品「這位顧客會想要嗎」。
規則引擎再用這些答案組出完整的決策(區塊、商品、數量),跟 Claude 一樣經過 sanitize。
顧客自己指定的店型 / 深淺色、說出口的送禮需求,永遠優先於 jev 的判斷。

## 即時的部分

- **市場模擬器**(`server/index.ts` 的 `marketTick`):每 2.5 秒模擬其他顧客下單、補貨、閃購調價,
  透過 WebSocket 推給所有人。卡片會閃一下,右側「即時動態」會出現紀錄
- **購物車價格是活的**:加入後降價 / 漲價會標出來,結帳以當下價格計算
- **搶最後一件**:結帳在一個 transaction 裡檢查並扣庫存,兩人同時搶只有一人成功
- **重新決策的節流**:每位顧客同時最多一個決策在跑;連續點擊會合併成一次(900ms debounce);
  跑的途中又有新動作,結束後只再跑一次。市場事件觸發的重新決策每人每 20 秒最多一次(控制成本)
- **首屏不等 AI**:連上時先用規則引擎立刻出畫面,Claude 的決策回來後再替換

## 個性與需求

左下角「你是誰?」:MBTI(四個維度各選一邊)、星座、個性標籤、興趣、常逛分類、預算、
明暗,以及一段自由文字的**需求**。需求是**輸入**給模型的;輸出仍然只是 enum。
面板會即時顯示四種店型的分數(`shared/archetypes.ts` 的 `scoreArchetypes`),看得到為什麼。
沒有 API key 時規則引擎用這個分數選店型;有 key 時 Claude 綜合判斷。

**版面什麼時候換**:你自己改資料或切換顧客 → 立刻換(有 view transition)。
你瀏覽時觸發的重新決策 → **不會打斷正在看的這一頁**,換頁時才套用(右下角可以手動套用)。

## 檔案地圖

```
shared/decision.ts         決策 schema v2(前後端共用,Zod)
shared/archetypes.ts       四種店型的預設 + 個性 → 店型的評分
shared/personas.ts         MBTI / 星座 / 個性 / 興趣
shared/catalog.ts          商品目錄(24 件、6 類)
server/decision/jev.ts     jev 決策(回答題目 → 規則引擎組版面)
server/decision/claude.ts  Claude 決策(structured outputs + server-side fallback)
server/decision/rules.ts   規則引擎(無 key / 出錯 / 首屏)
server/decision/index.ts   選引擎 + sanitize
server/index.ts            REST + WebSocket + 市場模擬 + 決策排程
web/src/ds/                設計系統(token、元件、商品卡)
web/src/store/             商店:標頭 / 首屏 / 區塊 / 卡片 / 頁面,各有四種店型的變體
web/src/lab/               設計實驗室(/lab.html)
docs/design-spec.md        設計規格
```

## 刻意的取捨

- **effort 預設 `low`**:這個呼叫在每個動作後都會跑,延遲比深度重要。覺得決策太淺就設 `SHOP_CLAUDE_EFFORT=medium`
- **不用 SDK 的 `betaZodOutputFormat`**:它的 schema 轉換會把 `enum` 降級成描述文字,enum 就不再是硬限制。
  改送 Zod 原生的 JSON Schema,回來再用同一個 Zod schema 驗證
- **沒有登入**:demo 用選單切換顧客;要上線得加驗證(目前任何人都能改任何 userId 的購物車)
- **付款是模擬的**
