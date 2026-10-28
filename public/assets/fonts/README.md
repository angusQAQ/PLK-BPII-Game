# 課堂楷書字型

遊戲優先使用裝置預裝的標楷體（DFKai-SB／DFKaiSB／BiauKai）。沒有這些字型的裝置使用隨站提供的 `classroom-kai.woff2`，確保仍以繁體正楷顯示。所有文字指定 700 粗體，並允許瀏覽器為只有常規字重的楷書合成粗體。

網頁字型取自台灣數位發展部全字庫正楷體 TW-Kai，Version 11508.01。來源、固定提交、原始檔雜湊及字集記錄於 `classroom-kai.json`；來源網址為 https://github.com/rypervenche/cns11643-fonts 。字型原始著作權為 (c)2026 Ministry of Digital Affairs，依 SIL Open Font License 1.1 使用，完整授權見 `LICENSE-TW-Kai.md`。

此版本裁減為遊戲使用的字集並改名為 Classroom Kai；不改畫字形。WOFF2 與遊戲同源載入，無需字型 CDN，也不需要上網取得完整的 36 MB 字型。

增加詞語後，可用 FontTools 和 Brotli 重新製作：

```sh
python3 scripts/prepare-classroom-font.py /path/to/TW-Kai.ttf
```
