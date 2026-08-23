# -*- coding: utf-8 -*-
"""把 Natural Earth 國界轉成本 App 用的 SVG path，投影方式與節點座標一致。
輸出 data/borders.json，直接被 app.js 讀入畫底圖。"""
import json, io, os
import geopandas as gpd
from shapely.geometry import box
from shapely.ops import transform

OUT = os.path.join(os.path.dirname(__file__), "..", "data", "borders.json")

# 與 app.js 的 MAP 節點相同的線性投影
LON0, LON1 = 12.4, 17.2
LAT0, LAT1 = 47.3, 50.5
W, H = 620.0, 430.0
DX, DY = 40.0, 50.0

# 為了讓國界延伸出畫布邊緣、不出現懸空斷面，裁切框放大一圈
CLIP = box(LON0 - 1.2, LAT0 - 1.0, LON1 + 1.2, LAT1 + 1.0)

WANT = {
    "Czechia":  "cz",
    "Austria":  "at",
    "Germany":  "de",
    "Slovakia": "sk",
    "Hungary":  "hu",
    "Poland":   "pl",
    "Slovenia": "si",
    "Italy":    "it",
    "Switzerland": "ch",
}


def proj(lon, lat):
    x = (lon - LON0) / (LON1 - LON0) * W + DX
    y = (LAT1 - lat) / (LAT1 - LAT0) * H + DY
    return x, y


def ring_to_path(coords):
    pts = []
    for lon, lat in coords:
        x, y = proj(lon, lat)
        pts.append("%.1f %.1f" % (x, y))
    if not pts:
        return ""
    return "M" + pts[0] + "".join("L" + p for p in pts[1:]) + "Z"


def geom_to_path(geom):
    parts = []
    gs = geom.geoms if geom.geom_type == "MultiPolygon" else [geom]
    for g in gs:
        if g.is_empty:
            continue
        # 丟掉極小碎塊（外島、飛地）避免畫面雜訊
        if g.area < 0.02:
            continue
        parts.append(ring_to_path(list(g.exterior.coords)))
    return "".join(parts)


def main():
    g = gpd.read_file(gpd.datasets.get_path("naturalearth_lowres"))
    g = g[g.name.isin(WANT.keys())].copy()
    g["geometry"] = g.geometry.intersection(CLIP)
    # 簡化：容差以「度」為單位，0.02° 約 1.5–2 公里，對這個尺度綽綽有餘
    g["geometry"] = g.geometry.simplify(0.02, preserve_topology=True)

    out = []
    for _, r in g.iterrows():
        if r.geometry.is_empty:
            continue
        d = geom_to_path(r.geometry)
        if d:
            out.append({"k": WANT[r["name"]], "n": r["name"], "d": d})

    order = ["pl", "de", "sk", "hu", "si", "it", "ch", "at", "cz"]
    out.sort(key=lambda x: order.index(x["k"]) if x["k"] in order else 99)

    json.dump(out, io.open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
    total = sum(len(o["d"]) for o in out)
    for o in out:
        print("%-3s %-12s path %5d 字元" % (o["k"], o["n"], len(o["d"])))
    print("合計", total, "字元；檔案", os.path.getsize(OUT), "bytes")


if __name__ == "__main__":
    main()
