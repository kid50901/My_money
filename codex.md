# 月序 Monthly Balance — Codex 專案交接紀錄

更新日期：2026-11-08（Asia/Bangkok）

## 專案與位置

- 用途：以月份管理個人資產、收入、負債、現金流與銀行帳單支出。
- 介面語言：繁體中文；報表以台幣計價。
- 工作區：`/Users/leon/Documents/Codex/My_money`
- **實際網站程式碼與有效 Git 歷史位於 `monthly-ledger/`。開發、測試、提交、推送均應進入此目錄。**
- 外層工作區也有 `.git` 與 GitHub remote，但不是目前已部署程式碼的版本來源。避免直接在外層 `git add .`，以免把財務檔案或內層 repository 當成子模組上傳。

## 網站與 GitHub

- 網站：https://leon-monthly-ledger.s98210039.chatgpt.site
- GitHub：https://github.com/kid50901/My_money
- 網站專案 ID：`appgprj_6adba1fcd094819186460fb944015951`
- 部署設定：`monthly-ledger/.openai/hosting.json`
- D1 binding：`DB`；目前未使用 R2。
- 最近一次在此對話確認部署並同步 GitHub的版本：`d41a840`（2026-11-07，新增每月記帳排序）。
- 網站採 Sites 私人存取；維持現有 audience，不因部署而改成公開。
- GitHub 推送使用 `kid50901`；`Leon-Hua` 曾因無寫入權限收到 403。
- 內層 GitHub remote 名稱為 `github`；Sites 原始碼同步由 Sites helper 處理，勿假設 `origin` 一定存在。
- 帳號與權限可能改變，操作前檢查 `gh auth status`、`git remote -v` 與網站 access 設定。

## 技術架構與檔案

採 React、TypeScript、Vinext/Vite、Cloudflare Workers、D1、Drizzle、Recharts、Mozilla PDF.js。

| 路徑（相對於 monthly-ledger） | 用途 |
| --- | --- |
| `app/ledger.tsx` | 主介面、月份切換、設定、儲存與復原狀態 |
| `app/model.ts` | Account、Row、Data、Expense、StatementMeta 型別及財務彙總 |
| `app/finance.ts` | 月份預填、股票收益、帳戶停用、明細編輯及 CSV 備份 |
| `app/entry-panel.tsx` | 每月資產／收入／負債輸入介面 |
| `app/entry-sort.ts` | 欄位排序規則 |
| `app/backup-panel.tsx` | 所有月份匯出、版本還原視窗 |
| `app/expenses-page.tsx` | PDF 匯入預覽、密碼視窗、支出明細與圖表 |
| `app/pdf-reader.ts` | 瀏覽器內解鎖 PDF 與擷取文字座標 |
| `app/statement-parser.ts` | Bangkok Bank 交易解析、合計／餘額核對、交易去重 |
| `app/api/ledger/route.ts` | 個人資料讀寫、版本備份、併發更新防護 |
| `app/api/ledger/restore/route.ts` | 還原指定使用者的存檔版本 |
| `app/api/quote/route.ts` | 月初股價與匯率查詢 |
| `app/api/import/route.ts` | 既有 Excel 匯入用的私人維護端點 |
| `app/import-data.ts` | 資料驗證及匯入合併 |
| `app/chatgpt-auth.ts` | Sites 提供的 ChatGPT 身分整合 |
| `db/schema.ts`、`drizzle/` | D1 schema 與不可任意改寫的遷移歷史 |
| `docs/USAGE.zh-TW.md` | 詳細操作說明 |
| `tests/finance.test.ts` | 核心公式、預填、停用、解析與去重測試 |
| `tests/local-api.mjs` | 僅限 localhost 的儲存、版本還原、帳號隔離與衝突測試 |

### 實際資料儲存

- 資產、收入、負債是應用程式內的邏輯分類；**目前不是三張獨立 SQL 明細表**。
- `ledgers`：以使用者 ID 為鍵，將帳戶、各月紀錄、支出明細及匯入資訊存於 JSON `payload`。
- `ledger_versions`：保留儲存／還原前的完整 JSON 版本，並有使用者與時間索引。
- 每次寫入使用 revision 比對，避免舊分頁覆蓋較新存檔。
- 目前 ledger API 接受的 JSON request 上限為 2 MB；增加支出資料量前須評估 D1 儲存與備份方式，不能只移除前端限制。
- 使用 Sites 提供的穩定使用者 ID 隔離資料；勿把 GitHub 帳號 ID 或 email 當成相同身分。

## 已完成行為與計算規則

### 每月記帳

- 新月份進入記帳頁時，僅在該月尚無紀錄時預填一次。
- 優先使用上月；上月缺資料時，取最近較早的有紀錄月份，並提示來源。
- 預填數量及換算率；本月新增股票數量歸零，不複製舊月份的金額例外、來源與還款日期欄位。
- 已移除手動「帶入上月數量」按鈕，防止誤覆寫。
- 股票報價與數量都需確認後儲存；預填的價格不代表本月已更新報價。

### 帳戶停用

- 設定頁的「刪除（停用）」從所選月份的次月起生效。
- 新月份不再預填該帳戶，歷史與已存在的紀錄保留。
- 勾選「顯示已停用帳戶」可恢復。

### 股票收益

- 收入名稱為「股票」、連結單一股票帳戶，或選擇全部股票組合時，可自動計算。
- 公式：`Σ[(本月持有數量 − 本月新增數量) × 本月台幣單價 − 上月台幣價值]`。
- 新增數量使用帳戶相同單位，不能超過目前持有數量。
- 台股以「張」記錄的帳戶，更新每股股價後乘以 1,000；美股使用「股」。
- Excel 歷史股票收入保留原值；修改該月資產或更新報價後，該月股票收益轉為自動計算。
- 缺少上月資料時提示待補資料，避免將首月全部持股價值視為收益。
- 報價來源為 Yahoo Finance；取每月一號或之前最近交易日收盤價，外幣股票再換算台幣。查詢可能失敗，介面允許手動輸入。

### 現金流

- 淨資產 = 總資產 − 總負債。
- 月支出 = 月收入 −（本月淨資產 − 上月淨資產）。
- 現金流 = 月收入 − 月支出。
- 沒有上月紀錄時，支出與現金流顯示「—」，不補造數值。
- Statement 支出明細的分析獨立運作，不再重複扣減上述推算現金流。

### 誤觸復原與備份

- 「放棄未儲存修改」可回到此次載入／成功儲存的雲端狀態，會先確認。
- 「存檔紀錄」還原全部月份、帳戶與支出；還原前的雲端狀態也再保留一份。
- 版本功能從 2026-11-01 更新開始，不能回溯先前未備份且已覆寫的資料。
- 介面列出最近 20 筆版本；目前程式未實作自動清除更早版本。
- 可分別匯出所有月份的資產／收入／負債 CSV，包含停用帳戶；另有支出 CSV 與完整 JSON 備份。
- 匯出內容以目前草稿為準，不受畫面月份限制。完整 JSON 下載不等於已實作 JSON 檔案還原介面。

### 排序與手機介面

- 資產、收入、負債明細可依名稱、類別、幣別、換算率、QTY、台幣金額排序；資產另有新增數量、負債另有還款日。
- 電腦點欄位標題切換升冪／降冪；手機使用排序選單。
- 數值依真實數字排序，股票收入依顯示計算值排序；空白／待上月資料項目置底。
- 可選原始順序；三種類別在元件存在期間各自記住排序，未持久化排序偏好。
- 手機版採直式卡片、大輸入欄位與底部導覽。

## Excel 歷史匯入

- 原始檔案：工作區根目錄 `Leon理財new.xlsx`，未修改。
- 已處理：資產 1,579 筆、收入 233 筆、負債 77 筆，另從現金流表補入早期月收入 41 筆。
- 範圍：2018-10 至 2026-09，共 95 個有資料月份；原表缺少 2022-06，未補造。
- 5 筆台幣金額與單價乘數量不符：以 `amountOverride` 保留來源金額，編輯數量／價格後改用乘積。
- 原表月度彙總與明細有差異；以匯入明細重新計算，未新增假造調整項目。
- 工作區根目錄的 `匯入核對報告.md`、`匯入核對報告.json` 記錄差異，含私人財務內容。
- 支出明細、預算與輔助工作表未納入該次歷史匯入。
- 當時雲端讀回確認為待擁有者領取的匯入資料；後續實際領取與目前資料狀態應以正式資料庫為準，不依此文件推定。

## Statement PDF

- 本機範本：工作區根目錄 `Statement of 582-4-xxx750.PDF`。
- 目前只支援此範本的 Bangkok Bank 存款帳單格式；不能宣稱支援所有銀行、信用卡或掃描 PDF。
- 密碼由使用者在瀏覽器視窗輸入；**不在此文件、程式碼或設定記錄密碼**。
- PDF 與密碼在裝置內處理，只有確認匯入後的交易明細隨儲存寫入雲端。
- 每份上限 15 MB、50 頁。
- 解析核對轉入／轉出筆數、合計與逐筆餘額；核對未通過時阻止匯入。
- 範本解析檢查通過：77 筆，包含 74 筆轉出、3 筆轉入。
- 一般轉帳預設待確認，不直接當支出／薪資；可調整種類、分類與備註。
- 確認匯入時，須確認該月原幣換算台幣匯率。
- 使用日期、說明、金額、餘額、帳號識別與同筆次序去重，重複匯入保留既有交易編輯。

## 開發、檢查與部署

先進入實際專案：

```bash
cd /Users/leon/Documents/Codex/My_money/monthly-ledger
git status --short
git remote -v
```

一般檢查：

```bash
npx tsc --noEmit
npm test
git diff --check
```

- `npm run db:generate` 只在 schema 改變時執行；檢查並提交新 migration 與 metadata。
- 已套用的 migration 不改寫，後續變更追加 migration；避免在 request handling 中建表或修改 schema。
- `npm run dev` 提供開發預覽。
- `npm run start` 需先建置，使用產出的 Worker 與本機 D1；`node tests/local-api.mjs` 只允許 localhost，會寫入合成測試資料。
- 本機測試資料庫與正式雲端資料庫不同，勿為了測試寫入正式財務資料。

更新已部署網站時，先讀取當次可用的 **Sites SKILL.md**；插件路徑會隨版本改變，不硬編碼本文件中的舊版本路徑。

1. 讀取 `.openai/hosting.json` 並重用既有 project ID。
2. 透過 Sites 取得最新網站 access 狀態與 source write credential，使用 source helper 開啟同一 checkout。
3. 完成功能與必要檢查；依當次技能執行建置、原始碼同步與 artifact 封裝。
4. 使用 helper 回傳的精確 project ID、commit SHA、archive 發布，保留私人存取設定。
5. 等待 deployment terminal success 與正式 URL，不把「已送出」當成部署成功。
6. 同步 GitHub：在內層 repository 執行 `git push github main`，不得 force push 覆蓋他人更新。
7. 使用者已持續要求網站更新同步 GitHub；一般功能變更沿用此工作流程。

## 安全、限制與接續工作

- 原始 Excel、PDF、財務核對報告、資料庫、備份與密碼不提交 GitHub；內層 `.gitignore` 已忽略 PDF、XLSX、環境檔與本機 runtime。
- Credentials、短期 token、service access token 僅放當次記憶體，透過 stdin 傳遞，不能寫入此文件或程式碼。
- `/api/import` 為私人維護端點，依賴 Sites owner-private 存取邊界；若未來調整 audience，**必須先重新設計並檢查此端點的授權**。
- 歷次已通過：TypeScript、正式建置、財務邏輯測試、範本 PDF 核對、本機版本還原／帳號隔離／併發衝突測試、排序邏輯檢查。
- 過去瀏覽器與原生畫面控制不可用或逾時，因此手機實機畫面與完整瀏覽器互動流程尚未驗證；不可把程式檢查稱為手機實測。
- 後續優先驗證：手機記帳／排序、密碼錯誤重試與取消、實際 PDF 匯入儲存、正式登入後的存檔還原流程。
- 此文件是交接紀錄，不代表目前雲端資料或登入狀態已重新查核；每次維護先確認當下狀態。
