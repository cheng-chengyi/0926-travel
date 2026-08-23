# 奧捷 12 天隨身手冊（PWA）

音樂與古城之間優雅｜奧地利・捷克 12 天　115/9/26－10/7
離線優先的隨身手冊，設計給手機在歐洲無網路時使用。

**v2.1.0 新增**：每日離房確認清單（共通 9 項＋各日專屬 35 項，逐日獨立記錄）。

**v2.0.0 新增**：天氣預報（可離線看快取）、匯率換算、旅行社貼心提醒十一大項、
分組打包清單（47 項）、團費包含明細、自由日路線可選、「我的」頁個資本機儲存與匯出匯入。

---

## 一、檔案結構

```
index.html              主頁面
app.css                 樣式
app.js                  應用邏輯
sw.js                   Service Worker（離線快取）
manifest.webmanifest    PWA 設定
data/itinerary.json     全部行程內容（要改內容改這裡）
data/photos.json        要預先快取的照片檔名清單
assets/photos/          照片放這裡
icons/                  App 圖示
tools/make-photo-list.sh 自動產生 photos.json
tools/merge.py           把旅行社文件併進 itinerary.json（已執行過，留存備查）
```

---

## 二、部署到 GitHub Pages

1. 在 GitHub 建一個新 repo，例如 `austria-czech`。
2. 把本資料夾內所有檔案推上去（放在 repo 根目錄）。
   ```bash
   git init
   git add .
   git commit -m "奧捷 12 天隨身手冊 v1"
   git branch -M main
   git remote add origin https://github.com/cheng-chengyi/austria-czech.git
   git push -u origin main
   ```
3. repo → Settings → Pages → Source 選 `main` / `root` → Save。
4. 約一分鐘後開 `https://cheng-chengyi.github.io/austria-czech/`。

所有路徑都是相對路徑，放在子目錄也能正常運作，不必修改任何檔案。

### ⚠️ 私有 repo 不等於私密網站

GitHub Pro 可以從 **private repo** 發布 Pages，原始碼不會外流。
但**發布出來的網站本身仍然是公開的**——任何人拿到網址都能開啟，
部署後的 HTML、CSS、JS、JSON 全都可以下載。
要讓網站本身也需要登入才能看，必須是 GitHub Enterprise Cloud 組織才辦得到。

**所以本專案的規則是：repo 裡不放任何個資。**
機票票號、訂位代號、常客號、電話、信箱、分房名單，
一律透過 App 的「我的」頁在手機上輸入，只存在該台裝置的 localStorage。
換手機時用「匯出我的資料」產生 JSON 檔自行保管，再到新手機「匯入」。
那個 JSON 檔請放在 pCloud 或本機，**不要 commit 進 repo**。

建議在 repo 根目錄放一個 `.gitignore`：

```
奧捷-我的資料.json
*.bak
data/itinerary.backup.json
```

---

## 三、安裝到手機（離線關鍵步驟）

**iPhone**：Safari 開網址 → 分享鈕 → 加入主畫面。
**Android**：Chrome 開網址 → 選單 → 安裝應用程式。

⚠️ 安裝後請在**有網路時把每一頁都點過一遍**（12 個日次＋城市／購物／實用／我的），
Service Worker 才會把全部內容存進裝置。之後即使完全沒有網路，開 App 一樣完整可用。
頂欄右上角的圓點是連線指示：綠色＝有網路，金色＝離線中（內容照樣看得到）。

---

## 四、放照片

1. 把照片放進 `assets/photos/`，檔名用英文，例如 `prague_clock.jpg`。
   建議先壓到寬 1600px 以內、每張 200–400KB，全部加起來控制在 30MB 內，
   免得手機第一次快取太久。
2. 執行 `bash tools/make-photo-list.sh` 更新 `data/photos.json`
   （或直接手動編輯成 `["prague_clock.jpg","charles_bridge.jpg"]`）。
3. 到 `data/itinerary.json` 對應的日次加上 `photos` 欄位：
   ```json
   "photos": [
     { "file": "prague_clock.jpg", "cap": "天文鐘鐘面特寫，下午順光時色彩最飽和。" }
   ]
   ```
4. 把 `sw.js` 第 3 行的 `VERSION` 加一（目前是 `oc-v2`，改成 `oc-v3`），
   推上去，手機重開 App 就會更新。

照片還沒放進去時，App 會顯示斜紋佔位框與檔名，不會壞掉。

---

## 五、改內容

所有文字都在 `data/itinerary.json`，改完推上去、`VERSION` 加一即可。
主要欄位：

| 欄位 | 用途 |
|---|---|
| `movement` / `tempo` | 樂章名與速度記號（顯示在日次抬頭） |
| `title` / `route` / `km` | 標題、路線、車程 |
| `summary` | 當日導言 |
| `sights[]` | 景點：`name` 名稱、`history` 歷史、`musts[]` 必看條列 |
| `routes[]` | 自由日的建議路線 |
| `frames[]` | 經典畫面怎麼拍 |
| `food` | `breakfast` / `lunch` / `dinner` |
| `tickets[]` | 當日門票（含退費條件） |
| `offbus[]` | 下車參觀點 |
| `special[]` | 特別安排與加贈項目 |
| `caveat` | 當日紅框提醒 |
| `wx` | 對應 `wxCities` 的城市代碼，決定抓哪裡的天氣 |

**每日確認清單**在 `dailyCheck`：`base[]` 是每天都要看的共通項（護照、保險箱、房卡…），
`byDay` 用日次編號帶各日專屬項（過夜包、退稅單、耳機歸還…），
專屬項排在前面並標「當日」。勾選以 `dc:<日次>:<序號>` 存本機，逐日獨立、互不影響。
| `stay` | `label`、`options[]`、`caveat`、`tip` |
| `shop` | 當日購物小吃 |
| `verify: true` | 該日顯示「待您核對」紅框 |

全域欄位：`meta.meet` 集合資訊、`meta.flights` 航班、`meta.hsr` 高鐵、
`wxCities` 天氣座標、`climate` 離線氣候概況、`tips` 貼心提醒、
`packingGroups` / `packingTips` 打包、`fees` 團費、`gifts` 超值好禮。

---

## 六、天氣怎麼運作

- 資料來源 Open-Meteo（免金鑰、免註冊、支援跨網域），只抓行程涵蓋的 6 個城市。
- 有網路時自動更新一次（距上次超過 3 小時才抓），也可到「實用 → 天氣」按「更新預報」。
- 抓到的預報存進 localStorage，**離線時照樣看得到**，並標示「更新於 ⋯」。
- 氣象預報上限是未來 16 天，所以要到出發前兩週左右才抓得到這趟的資料。
  在那之前，「氣候概況」那段永遠離線可看，足以判斷穿著。
- 沒有網路時 App 其餘部分完全不受影響。

## 六之二、匯率怎麼運作

- 資料來源 Frankfurter（歐洲央行每日參考匯率，免金鑰、支援跨網域）。
- 到「實用 → 匯率」按「自動更新匯率」，抓 EUR→TWD 與 EUR→CZK，
  再換算出 1 克朗兌台幣，存進 localStorage，離線照樣換算。
- 抓到的是**中價**。銀行現鈔賣出通常比中價貴 1–2%，刷卡約中價加 1.5% 手續費。
  想用實際換到的價格，兩個匯率格可以直接手動改，改完就以手動值為準。
- 天氣與匯率是全 App 僅有的兩個對外連線；兩者都失敗時，只是沿用舊值，不影響其他功能。

---

## 七、目前待補

- **照片**：已從旅行社行程表 PDF 抽出 16 張（第 2、3、5、6、7、8、9、10 天），
  第 1、4、11、12 天無對應照片。若要換成自己拍的，把檔案放進 `assets/photos/`，
  再到 `data/itinerary.json` 對應日次的 `photos` 陣列改檔名與圖說，
  並把檔名加進 `data/photos.json`（Service Worker 靠它預快取）。
- **領隊資訊**：行程表上領隊、導遊欄位是空白的，行前說明會後填進 App 的「我的」頁。
- **航廈**：電子機票兩段皆為第一航廈，使用者已確認；App 統一顯示第一航廈。
- **高鐵**：PDF 只確認台南－桃園來回標準廂、65 歲長者商務廂；兩班時間暫不顯示，待旅行社提供車票後再填。
- **住宿確認**：`stay.options` 是旅行社給的候選名單，實際入住哪一家可填在「我的」頁。

---

## 七之二、地圖怎麼改

- **底圖**：`data/borders.json`，由 `tools/make-borders.py` 從 Natural Earth 1:110m
  國界資料產生，投影參數（LON0/LON1/LAT0/LAT1/W/H/DX/DY）與 `app.js` 的 `MAP`
  節點座標一致，改投影要兩邊一起改。整包 1.9 KB，隨核心檔一起預快取。
- **節點**：`app.js` 的 `MAP` 陣列。`x` / `y` 是 700×530 畫布位置，
  `lx` / `ly` 是文字相對節點偏移，`a` 是 `text-anchor`（`start` 在右、`end` 在左），
  `big: 1` 是連住城市的實心大點。`LEGS` 決定連線順序。
- **逐日小地圖**：`DAYNODES` 指定每一天對應哪些節點；有兩個以上節點的日次會把
  當天路段加粗，其餘路線淡化。點任一城市會跳到 `dayOfNode()` 算出的日次。
- 標籤都畫兩層（底層 `.halo` 描邊、上層填色），壓在路線上也看得清楚。
- 整張是純 SVG，不依賴任何地圖服務或圖磚，離線完全可用。

### 布拉格市區圖（自由日）

`app.js` 的 `PG` 物件，每個站點是 `[x, y, 顯示名, text-anchor, 標籤 x 偏移, 標籤 y 偏移]`。
名稱留空的是輔助點，不畫圓點也不進路線折線。`VLTAVA` 是河道路徑，
由六個實際河道點以 lon 14.390–14.436 / lat 50.100–50.072 投影而成。
路線資料在 `data/itinerary.json` 第 4 天的 `routes[]`：
`stops[]`（`k` 對應 `PG` 的鍵、`t` 時間、`n` 站名、`note` 說明）、
`cost[]`、`sum`、`eval{fit,legs,risk}`、`hours`、`tag`。
一次只展開一條，選擇以**路線名稱**存在 `route:4`（不用序號，增刪路線才不會指錯）。

## 八、設計說明

- 12 個日次以樂章編號排列，速度記號對應當天節奏：
  Allegro（初見布拉格）、Rubato（自由日）、Andante（拉車日）、
  Adagio（湖區慢日）、Tempo di valse（維也納音樂會日）、Coda（返程）。
- 日次抬頭下方的五線譜細線是全站唯一的裝飾紋樣。
- 配色：石灰壁 `#EEF0EB`、墨綠 `#16231E`、波希米亞石榴石 `#8C1D33`、
  特蕾莎黃 `#C7972A`、銅鏽綠 `#4E7A6B`。
- 字型使用系統內建（iOS 蘋方／Android Noto Sans TC），不外連字型 CDN，
  確保離線可用也不必內嵌數 MB 的中文字檔。若之後想換成 Noto Serif TC，
  需自行子集化後放進 `assets/fonts/` 並加入 `CORE` 快取清單。
- 「我的」頁、打包勾選、自由日路線選擇、匯率、天氣快取，
  全部存在裝置的 localStorage，不會上傳、也不在 repo 裡。
  建議不要在「我的」頁放護照號碼或信用卡卡號——手機遺失時那等同攤開給撿到的人。
