# -*- coding: utf-8 -*-
"""把抽出的照片掛到各日次，並產生 photos.json 供 Service Worker 預快取。"""
import json, io, os

B = os.path.join(os.path.dirname(__file__), "..")
P = os.path.join(B, "data", "itinerary.json")
D = json.load(io.open(P, encoding="utf-8"))
days = {d["n"]: d for d in D["days"]}

M = {
 2:  [("prague-astronomical-clock.webp", "布拉格天文鐘——1410 年建成，世界第三古老且仍在計時；整點時十二門徒繞行，登塔可俯瞰舊城廣場"),
      ("prague-charles-bridge.webp",     "查理大橋——長 505 公尺、16 座橋墩，連接舊城與城堡區的百年石橋")],
 3:  [("prague-vltava-cruise.webp",      "伏爾塔瓦河遊船——第 3 天午宴在船上，從河面看兩岸是另一種角度"),
      ("prague-municipal-house.webp",    "市民會館——新藝術運動代表建築，內部有慕夏壁畫；史麥塔那廳是布拉格之春主場地")],
 5:  [("karlovy-vary.webp",              "卡羅維瓦利——查理四世狩獵時發現的溫泉，泉水含 40 種以上礦物質，可飲可浴"),
      ("marianske-lazne.webp",           "瑪麗安斯基——藍頂白柱的卡洛琳溫泉館，比卡羅維瓦利更安靜")],
 6:  [("cesky-krumlov.webp",             "庫倫洛夫——1992 年列入世界文化遺產，伏爾塔瓦河在此形成倒 S 型河灣"),
      ("krumlov-castle-tower.webp",      "彩繪塔——外牆馬賽克磁磚得名，約 147 階，塔內樓梯陡峭")],
 7:  [("salt-mine.webp",                 "貝希特斯加登鹽礦——換上礦工服，搭單軌車入坑、溜木滑梯下探，坑內約 12°C"),
      ("konigssee.webp",                 "國王湖（本團行程未安排，僅供參考）——僅出現在行程表的圖片說明頁")],
 8:  [("hallstatt.webp",                 "哈修塔特——湖區 76 個湖泊中最知名的小鎮，1997 年列為世界文化遺產"),
      ("st-wolfgang.webp",               "聖沃夫岡——十二個湖泊串連的湖區北岸，《真善美》取景地")],
 9:  [("parndorf-outlet.webp",           "潘朵芙購物村——奧地利最大 Outlet，距維也納約 50 公里，車程 40–50 分鐘"),
      ("st-stephens-cathedral.webp",     "聖史蒂芬大教堂——1147 年興建，14 世紀改建為今日的哥德式樣貌")],
 10: [("schonbrunn-palace.webp",         "熊布朗宮（美泉宮）——瑪麗亞特蕾莎女皇代表建築，維也納會議舉行地"),
      ("hofburg-palace.webp",            "霍夫堡皇宮——哈布斯堡家族居所達 640 年，佔地 24 萬平方公尺")],
}

files = []
for n, lst in M.items():
    days[n]["photos"] = [{"file": f, "cap": c} for f, c in lst]
    files += [f for f, _ in lst]

json.dump(D, io.open(P, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump(files, io.open(os.path.join(B, "data", "photos.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)
print("掛上", len(files), "張，涵蓋第", sorted(M.keys()), "天")
