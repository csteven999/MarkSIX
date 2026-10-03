# 六合彩攪珠結果

純靜態網站（GitHub Pages）＋ GitHub Actions 每日自動更新。手機與電腦皆自動適配。

## 檔案結構

```
index.html                      頁面（讀取 data/results.json）
data/results.json               攪珠資料，最多保留 200 期
scripts/fetch.mjs               向 HKJC 抓取並按期數合併
.github/workflows/update.yml    排程與手動執行
```

## 部署

1. 建立 GitHub repo，推送所有檔案，**確認 `.github/` 隱藏資料夾有一併上傳**。
2. Settings → Pages → Source 選 `Deploy from a branch`，Branch 選 `main` / `(root)`。
3. Settings → Actions → General → Workflow permissions 選 `Read and write permissions`。
4. 網址為 `https://<帳號>.github.io/<repo 名>/`。

## 更新方式

- **自動**：每日 22:30 與 01:00（香港時間）各執行一次，抓最近 10 期，有新結果才 commit。
- **手動回填**：Actions → `Update Mark Six results` → `Run workflow`，在 `count` 填 `100`（最多 500）即可補抓最近 100 期。留空則為日常模式。
- 同一期號以 HKJC 官方資料為準，會覆蓋 `results.json` 內的舊資料。
- 本機測試：`node scripts/fetch.mjs`，或 `COUNT=100 node scripts/fetch.mjs`（需 Node 18+）。

## 初始資料

`data/results.json` 內附 26/086 至 26/105（2026-08-08 至 2026-10-03）共 20 期，由第三方網站整理而成，未經馬會官方逐期核對。首次手動回填後會被官方資料覆蓋校正。

## 已知限制

- 資料來源為 HKJC GraphQL（`info.cld.hkjc.com/graphql/base/`），此端點非正式公開文件，格式或存取條件可能改變。若 Actions 失敗，先查看日誌中印出的 API 回應，再調整 `scripts/fetch.mjs` 的查詢欄位。
- GitHub 排程可能延遲，攪珠後數十分鐘內未必更新；01:00 的第二次執行用作補抓。
- 公開 repo 若 60 日無任何 commit，GitHub 會停用排程；平日每週有新攪珠即有 commit，一般不受影響。
- 歷史號碼僅供記錄，每期為獨立隨機事件，不能預測下一期。
