# -*- coding: utf-8 -*-
"""從行程表 PDF 逐頁渲染，偵測棕色標籤條，裁出右側照片並存成 WebP。
判定方式：標籤色塊的欄位幾乎整欄都是棕色；照片裡的褐色調不會整欄成立。"""
import os, subprocess, glob
from PIL import Image
import numpy as np

PDF = "/mnt/user-data/uploads/260926PRG12A音樂與古城之間優雅長旅_奧地利_捷克_12_天.pdf"
TMP = "/home/claude/pics"
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "photos")
BROWN = (167, 123, 96)
TOL = 28
PAGES = [10, 13, 17, 19, 21, 24, 27, 30]
NAMES = [
    "prague-astronomical-clock", "prague-charles-bridge",
    "prague-vltava-cruise", "prague-municipal-house",
    "marianske-lazne", "karlovy-vary",
    "cesky-krumlov", "krumlov-castle-tower",
    "salt-mine", "konigssee",
    "hallstatt", "st-wolfgang",
    "parndorf-outlet", "st-stephens-cathedral",
    "schonbrunn-palace", "hofburg-palace",
]

def render(pg):
    for f in glob.glob(os.path.join(TMP, "r-*.png")):
        os.remove(f)
    subprocess.run(["pdftoppm", "-png", "-r", "200", "-f", str(pg), "-l", str(pg),
                    PDF, os.path.join(TMP, "r")], check=True)
    return glob.glob(os.path.join(TMP, "r-*.png"))[0]

def main():
    os.makedirs(OUT, exist_ok=True)
    idx, made = 0, []
    for pg in PAGES:
        f = render(pg)
        im = Image.open(f).convert("RGB")
        a = np.asarray(im).astype(int)
        h, w, _ = a.shape
        m = ((abs(a[:, :, 0] - BROWN[0]) < TOL) &
             (abs(a[:, :, 1] - BROWN[1]) < TOL) &
             (abs(a[:, :, 2] - BROWN[2]) < TOL))
        white = (a[:, :, 0] > 245) & (a[:, :, 1] > 245) & (a[:, :, 2] > 245)

        rows = np.where(m.sum(axis=1) > w * 0.10)[0]
        if not len(rows):
            os.remove(f); continue
        groups = np.split(rows, np.where(np.diff(rows) > 5)[0] + 1)

        for g in groups:
            if idx >= len(NAMES) or len(g) < 200:
                continue
            y0, y1 = int(g[0]), int(g[-1])
            band = m[y0:y1 + 1]
            cover = band.sum(axis=0) / float(y1 - y0 + 1)
            solid = np.where(cover > 0.90)[0]          # 幾乎整欄棕色 = 標籤色塊
            if not len(solid):
                continue
            x0 = int(solid.max()) + 3
            nb = ~white[y0:y1 + 1]
            colhit = nb.sum(axis=0) / float(y1 - y0 + 1)
            right = np.where(colhit > 0.5)[0]
            x1 = int(right.max()) + 1 if len(right) else w
            if x1 - x0 < 400:
                continue
            crop = im.crop((x0, y0 + 3, x1, y1 - 2))
            crop.thumbnail((1100, 1100), Image.LANCZOS)
            name = NAMES[idx] + ".webp"
            crop.save(os.path.join(OUT, name), "WEBP", quality=80, method=6)
            made.append((pg, name, crop.size))
            idx += 1
        os.remove(f)

    for pg, n, s in made:
        print("p%-3d %-32s %sx%s" % (pg, n, s[0], s[1]))
    print("共", len(made), "張")

if __name__ == "__main__":
    main()
