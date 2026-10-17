#!/usr/bin/env python3
"""Cut the G1 art group (brand, scenes, landmarks) from the stakeholder asset sheets.

Usage: python3 scripts/art/cut_g1.py [--contact <png>]
Sources: requirement/assets/reference/asset-sheet-a.png and asset-sheet-b.png (1536x1024).
Writes public/art/mockup/{brand,scenes,landmarks}/<name>.png + .webp and a manifest.json per
folder, plus public/icons/icon-192.png and icon-512.png. Every crop box is listed below as
(x, y, w, h) in sheet pixels, so the cuts can be re-run when higher-resolution art arrives.
Needs Pillow, numpy and opencv-python-headless.
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SHEETS = {
    "sheet-a": os.path.join(ROOT, "requirement/assets/reference/asset-sheet-a.png"),
    "sheet-b": os.path.join(ROOT, "requirement/assets/reference/asset-sheet-b.png"),
    # Stakeholder upscales (2576x1717 JPEG) of the same sheets, aligned with the PNGs at a uniform
    # scale: boxes below are in PNG pixels and are scaled for these.
    "sheet-a-large": os.path.join(ROOT, "requirement/assets/reference/asset-sheet-a-large.jpg"),
    "sheet-b-large": os.path.join(ROOT, "requirement/assets/reference/asset-sheet-b-large.jpg"),
}
PNG_SIZE = (1536, 1024)
OUT = os.path.join(ROOT, "public/art/mockup")
PAD = 0.08

# ---------------------------------------------------------------- crop boxes (x, y, w, h)
BRAND = [
    # key, source, box, kind, alt vi, alt en
    ("logo", "sheet-a", (14, 6, 324, 212), "logo", "SwimQuest – Hải trình mùa đông", "SwimQuest – Winter Voyage"),
    ("logo-mark", "sheet-b", (1246, 826, 132, 98), "object", "Biểu tượng sóng SwimQuest", "SwimQuest wave mark"),
    ("app-icon", "sheet-a", (104, 218, 158, 152), "icon", "Biểu tượng ứng dụng SwimQuest", "SwimQuest app icon"),
]
# Scenes are rectangular. focus = horizontal centre of the subject (0..1) for the narrower crops.
SCENES = [
    ("hero-swimmers", "sheet-b", (2, 206, 322, 110), 0.58, "Hai vận động viên bơi sải trên biển xanh", "Two swimmers doing front crawl in a blue sea"),
    ("sea-sunset", "sheet-a", (302, 755, 292, 109), 0.5, "Biển lúc hoàng hôn", "The sea at sunset"),
    ("sea-island-day", "sheet-a", (609, 755, 277, 109), 0.5, "Đảo nhỏ giữa biển ngày nắng", "A small island in a sunny sea"),
    ("underwater-reef", "sheet-a", (901, 755, 294, 109), 0.6, "Rạn san hô dưới nước", "An underwater coral reef"),
    ("sea-night", "sheet-a", (1213, 755, 312, 109), 0.52, "Biển đêm trăng", "The sea on a moonlit night"),
    ("beach-da-nang", "sheet-b", (9, 828, 185, 147), 0.55, "Biển Đà Nẵng, bãi Non Nước", "Da Nang beach at Non Nuoc"),
    ("sunset-coast", "sheet-b", (201, 828, 163, 147), 0.6, "Bờ biển lúc hoàng hôn", "The coast at sunset"),
    ("sunrise-coast", "sheet-b", (370, 828, 180, 147), 0.45, "Bờ biển lúc bình minh", "The coast at sunrise"),
    ("sea-cu-lao-cham", "sheet-b", (558, 828, 236, 147), 0.5, "Biển Cù Lao Chàm", "The sea at Cu Lao Cham"),
    ("sea-ly-son", "sheet-b", (801, 828, 326, 147), 0.65, "Biển Lý Sơn", "The sea at Ly Son"),
]
SCENE_SIZES = {"16x9": (768, 432), "4x3": (640, 480), "9x16": (432, 768)}
# Landmark islands 1-7 from sheet B (the labels under them are left out of the boxes).
LANDMARKS = [
    ("landmark-01-non-nuoc", (1147, 38, 88, 84), "Bãi Non Nước", "Non Nuoc Beach"),
    ("landmark-02-son-thuy", (1244, 31, 86, 90), "Bãi Sơn Thủy", "Son Thuy Beach"),
    ("landmark-03-pham-van-dong", (1337, 38, 92, 82), "Bãi Phạm Văn Đồng", "Pham Van Dong Beach"),
    ("landmark-04-man-thai", (1431, 27, 98, 92), "Bãi Mân Thái", "Man Thai Beach"),
    ("landmark-05-hon-sup", (1152, 155, 120, 110), "Hòn Sụp", "Hon Sup"),
    ("landmark-06-cu-lao-cham", (1280, 165, 124, 104), "Cù Lao Chàm", "Cu Lao Cham"),
    ("landmark-07-ly-son", (1405, 155, 126, 110), "Lý Sơn", "Ly Son"),
]

_cache = {}


def sheet(name):
    if name not in _cache:
        _cache[name] = np.asarray(Image.open(SHEETS[name]).convert("RGB")).astype(np.int32)
    return _cache[name]


def to_source(src, box):
    """Scale a PNG-pixel box (x, y, w, h) to the pixels of `src`."""
    a = sheet(src)
    sx, sy = a.shape[1] / PNG_SIZE[0], a.shape[0] / PNG_SIZE[1]
    x, y, w, h = box
    return round(x * sx), round(y * sy), round(w * sx), round(h * sy)


def pick(base, use_large):
    return f"{base}-large" if use_large else base


def fill_holes(m):
    h, w = m.shape
    ff = np.pad(m.astype(np.uint8), 1) * 255
    mask = np.zeros((h + 4, w + 4), np.uint8)
    cv2.floodFill(ff, mask, (0, 0), 128)
    return ff[1:-1, 1:-1] != 128


def key_out(src, box, thr=46, pad=5, ellipse=False):
    """Remove the navy sheet background around one object: colour distance from the crop's border,
    keep the components that lie inside the box, fill holes, soft 1-2 px edge, de-fringe."""
    a = sheet(src)
    k = a.shape[1] / PNG_SIZE[0]
    x, y, w, h = to_source(src, box)
    pad = round(pad * k)
    X0, Y0 = max(0, x - pad), max(0, y - pad)
    X1, Y1 = min(a.shape[1], x + w + pad), min(a.shape[0], y + h + pad)
    c = a[Y0:Y1, X0:X1]
    border = np.concatenate([c[0], c[-1], c[:, 0], c[:, -1]])
    bg = np.median(border, axis=0)
    d = np.sqrt(((c - bg) ** 2).sum(2))
    fg = (d > thr).astype(np.uint8)
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    dl = cv2.dilate(fg, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(dl)
    sel = np.zeros(dl.shape, bool)
    bx0, by0, bx1, by1 = x - X0, y - Y0, x - X0 + w, y - Y0 + h
    inbox = np.zeros(dl.shape, bool)
    inbox[by0:by1, bx0:bx1] = True
    # The object is the component with the most pixels in the box, taken whole (never clipped).
    # Small parts (sparkles, spray) join it when they are inside the box and next to it;
    # neighbours, labels and stray specks are dropped.
    inside = [(lab == i) & inbox for i in range(n)]
    main_i = 1 + int(np.argmax([inside[i].sum() for i in range(1, n)]))
    sel = lab == main_i
    nk = 2 * round(8 * k) + 1
    near = cv2.dilate(sel.astype(np.uint8), np.ones((nk, nk), np.uint8)) > 0
    for i in range(1, n):
        comp = lab == i
        ar = comp.sum()
        if i == main_i or ar < max(30 * k * k, 0.004 * sel.sum()):
            continue
        if inside[i].sum() / ar >= 0.85 and (comp & near).any():
            sel |= comp
    sel = fill_holes(sel)
    if ellipse:
        # Islands are round: fill the bays where dark water matched the background. Only below
        # the top third, so the sky beside a lighthouse stays transparent.
        hull = np.zeros(sel.shape, np.uint8)
        cv2.fillConvexPoly(hull, cv2.convexHull(cv2.findNonZero(sel.astype(np.uint8))), 1)
        hull[: by0 + int(0.35 * (by1 - by0))] = 0
        sel |= hull > 0
    ek = 2 * round(2 * k) + 1
    inner = cv2.erode(sel.astype(np.uint8), np.ones((ek, ek), np.uint8)) > 0
    soft = np.clip((d - thr * 0.6) / (thr * 0.9), 0, 1)
    alpha = np.where(inner, 1.0, np.where(sel, soft, 0.0)).astype(np.float32)
    if ellipse:
        # Islands sit in round water halos that touch their neighbours and the labels below:
        # keep only a soft ellipse a little larger than the box.
        yy, xx = np.mgrid[0 : alpha.shape[0], 0 : alpha.shape[1]].astype(np.float32)
        cx, cy = (bx0 + bx1) / 2, (by0 + by1) / 2
        r = np.sqrt(((xx - cx) / (w * 0.56)) ** 2 + ((yy - cy) / (h * 0.56)) ** 2)
        alpha *= np.clip((1.0 - r) / 0.06, 0, 1)
    alpha = cv2.GaussianBlur(alpha, (0, 0), 0.6 * k)
    # De-fringe: un-mix the navy background from semi-transparent edge pixels.
    al = np.clip(alpha, 1e-3, 1)[..., None]
    rgb = np.where(alpha[..., None] < 0.98, (c - bg * (1 - al)) / al, c)
    rgb = np.clip(rgb, 0, 255)
    rgba = np.dstack([rgb.astype(np.uint8), (alpha * 255).astype(np.uint8)])
    im = Image.fromarray(rgba, "RGBA")
    bb = im.getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox()
    im = im.crop(bb)
    return im, (X0 + bb[0], Y0 + bb[1], bb[2] - bb[0], bb[3] - bb[1])


def hull_limit(obj, src, sbox):
    """Drop the warm glow the sheet paints around the logo: keep only what lies inside the convex
    hull of the logo's strong pixels (saturated wood and gold, bright blue, white)."""
    x, y, w, h = sbox
    c = sheet(src)[y:y + h, x:x + w].astype(np.uint8)
    hsv = cv2.cvtColor(c, cv2.COLOR_RGB2HSV)
    sat, val = hsv[..., 1].astype(int), hsv[..., 2].astype(int)
    red, blue = c[..., 0].astype(int), c[..., 2].astype(int)
    strong = ((sat > 150) & (val > 90)) | ((blue > red + 40) & (val > 150)) | (val > 235)
    strong = cv2.morphologyEx(strong.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(strong)
    keep = np.zeros_like(strong)
    for i in range(1, n):
        if st[i][4] >= 40 * (sheet(src).shape[1] / PNG_SIZE[0]) ** 2:
            keep[lab == i] = 1
    hull = np.zeros(strong.shape, np.uint8)
    cv2.fillConvexPoly(hull, cv2.convexHull(cv2.findNonZero(keep)), 1)
    hull = cv2.GaussianBlur(cv2.dilate(hull, np.ones((3, 3), np.uint8)).astype(np.float32), (0, 0), 0.8)
    arr = np.asarray(obj).copy()
    arr[..., 3] = (arr[..., 3] * hull).astype(np.uint8)
    im = Image.fromarray(arr, "RGBA")
    return im.crop(im.getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox())


def sharpen(im):
    return im.filter(ImageFilter.UnsharpMask(radius=1.4, percent=60, threshold=2))


def place(obj, cw, ch, pad=PAD):
    """Fit obj inside a cw x ch canvas with pad on each side, centred, aspect kept."""
    s = min(cw * (1 - 2 * pad) / obj.width, ch * (1 - 2 * pad) / obj.height)
    o = sharpen(obj.resize((max(1, round(obj.width * s)), max(1, round(obj.height * s))), Image.LANCZOS))
    canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    canvas.alpha_composite(o, ((cw - o.width) // 2, (ch - o.height) // 2))
    return canvas


def scene_crop(src, box, ratio, focus, size):
    a = sheet(src).astype(np.uint8)
    x, y, w, h = to_source(src, box)
    rw, rh = ratio
    if w / h > rw / rh:
        nw, nh = round(h * rw / rh), h
    else:
        nw, nh = w, round(w * rh / rw)
    cx = x + focus * w
    nx = int(min(max(x, cx - nw / 2), x + w - nw))
    ny = y + (h - nh) // 2
    im = Image.fromarray(a[ny:ny + nh, nx:nx + nw], "RGB")
    return sharpen(im.resize(size, Image.LANCZOS)), (nx, ny, nw, nh)


def save(im, group, name):
    d = os.path.join(OUT, group)
    os.makedirs(d, exist_ok=True)
    png = os.path.join(d, f"{name}.png")
    im.save(png, optimize=True)
    if os.path.getsize(png) > 300_000:
        # Large fallback PNG: 256-colour palette with dithering keeps it small; the WebP stays full colour.
        im.quantize(256, method=Image.Quantize.FASTOCTREE if im.mode == "RGBA" else Image.Quantize.MEDIANCUT,
                    dither=Image.Dither.FLOYDSTEINBERG).save(png, optimize=True)
    im.save(os.path.join(d, f"{name}.webp"), quality=90, method=4)
    return f"/art/mockup/{group}/{name}.png", f"/art/mockup/{group}/{name}.webp"


def entry(group, name, im, src, box, vi, en):
    png, webp = save(im, group, name)
    return {"key": f"{group}/{name}", "file": png, "webp": webp, "width": im.width, "height": im.height,
            "source": src, "box": [int(v) for v in box], "alt": {"vi": vi, "en": en}}


# Which source each asset is cut from, chosen by looking at both cuts side by side
# (`--compare <png>`): True = the large JPEG upscale, False = the PNG sheet.
USE_LARGE = {}


def source_for(base, name):
    return pick(base, USE_LARGE.get(name, True))


def main():
    if "--compare" in sys.argv:
        compare(sys.argv[sys.argv.index("--compare") + 1])
        return
    manifests = {"brand": [], "scenes": [], "landmarks": []}
    contact = []

    for name, base, box, kind, vi, en in BRAND:
        src = source_for(base, name)
        obj, sbox = key_out(src, box, thr=58 if kind == "logo" else 46)
        if kind == "logo":
            obj = hull_limit(obj, src, sbox)
            w = 1024
            im = place(obj, w, round(w * obj.height / obj.width * 1.04), pad=0.02)
        elif kind == "icon":
            im = place(obj, 512, 512, pad=0.04)
        else:
            im = place(obj, 512, 512)
        manifests["brand"].append(entry("brand", name, im, src, sbox, vi, en))
        contact.append(("brand", name, im))
        if kind == "icon":
            # PWA icons: the rounded icon on the app's navy, full bleed (manifest.ts points here).
            for size in (192, 512):
                bgc = Image.new("RGBA", (size, size), (6, 43, 70, 255))
                bgc.alpha_composite(place(obj, size, size, pad=0.06))
                bgc.convert("RGB").save(os.path.join(ROOT, f"public/icons/icon-{size}.png"), optimize=True)

    for name, base, box, focus, vi, en in SCENES:
        src = source_for(base, name)
        for label, size in SCENE_SIZES.items():
            ratio = tuple(int(v) for v in label.split("x"))
            if label == "9x16" and (base == "sheet-a" or name == "hero-swimmers"):
                continue  # too short or too wide for a portrait crop
            im, sbox = scene_crop(src, box, ratio, focus, size)
            manifests["scenes"].append(entry("scenes", f"{name}-{label}", im, src, sbox, vi, en))
            contact.append(("scenes", f"{name}-{label}", im))

    for name, box, vi, en in LANDMARKS:
        src = source_for("sheet-b", name)
        obj, sbox = key_out(src, box, thr=55, pad=14, ellipse=True)
        im = place(obj, 384, 288)
        manifests["landmarks"].append(entry("landmarks", name, im, src, sbox, vi, en))
        contact.append(("landmarks", name, im))

    for group, items in manifests.items():
        with open(os.path.join(OUT, group, "manifest.json"), "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
            f.write("\n")

    if "--contact" in sys.argv:
        contact_sheet(contact, sys.argv[sys.argv.index("--contact") + 1])


def compare(path):
    """PNG-sheet cut (left) next to large-JPEG cut (right) for every object, on navy and white,
    plus the 16:9 crop of every scene, to choose USE_LARGE by looking."""
    rows = []
    for name, base, box, kind, *_ in BRAND:
        pair = []
        for large in (False, True):
            obj, sbox = key_out(pick(base, large), box, thr=58 if kind == "logo" else 46)
            if kind == "logo":
                obj = hull_limit(obj, pick(base, large), sbox)
            pair.append(place(obj, 512, 384))
        rows.append((name, pair))
    for name, box, *_ in LANDMARKS:
        rows.append((name, [place(key_out(pick("sheet-b", lg), box, thr=55, pad=14, ellipse=True)[0], 384, 288) for lg in (False, True)]))
    for name, base, box, focus, *_ in SCENES:
        rows.append((name, [scene_crop(pick(base, lg), box, (16, 9), focus, (768, 432))[0].convert("RGBA") for lg in (False, True)]))
    cw, ch = 520, 300
    out = Image.new("RGB", (cw * 4, ch * len(rows)), (255, 255, 255))
    dr = ImageDraw.Draw(out)
    for r, (name, pair) in enumerate(rows):
        for i, im in enumerate(pair):
            for j, bgc in enumerate(((11, 42, 74, 255), (255, 255, 255, 255))):
                t = im.copy()
                t.thumbnail((cw - 10, ch - 20))
                cell = Image.new("RGBA", (cw, ch), bgc)
                cell.alpha_composite(t, ((cw - t.width) // 2, 2))
                out.paste(cell.convert("RGB"), ((i * 2 + j) * cw, r * ch))
        dr.text((4, r * ch + ch - 14), f"{name}: PNG | LARGE", fill=(255, 0, 0))
    out.save(path)


def contact_sheet(items, path):
    cell, cols = 220, 6
    rows = (len(items) + cols - 1) // cols
    sheet_im = Image.new("RGB", (cols * cell * 2, rows * (cell + 16)), (255, 255, 255))
    dr = ImageDraw.Draw(sheet_im)
    for i, (group, name, im) in enumerate(items):
        r, c = divmod(i, cols)
        t = im.copy()
        t.thumbnail((cell - 8, cell - 8))
        for k, bgname in enumerate(("checker", "navy")):
            ox, oy = c * cell * 2 + k * cell, r * (cell + 16)
            if bgname == "navy":
                bgim = Image.new("RGBA", (cell, cell), (11, 42, 74, 255))
            else:
                bgim = Image.new("RGBA", (cell, cell), (255, 255, 255, 255))
                bd = ImageDraw.Draw(bgim)
                for yy in range(0, cell, 12):
                    for xx in range(0, cell, 12):
                        if (xx // 12 + yy // 12) % 2:
                            bd.rectangle([xx, yy, xx + 11, yy + 11], fill=(214, 214, 214, 255))
            bgim.alpha_composite(t.convert("RGBA"), ((cell - t.width) // 2, (cell - t.height) // 2))
            sheet_im.paste(bgim.convert("RGB"), (ox, oy))
        dr.text((c * cell * 2 + 4, r * (cell + 16) + cell + 2), f"{group}/{name}", fill=(0, 0, 0))
    sheet_im.save(path)


if __name__ == "__main__":
    main()
