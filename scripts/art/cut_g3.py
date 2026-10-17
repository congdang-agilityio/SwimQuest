#!/usr/bin/env python3
"""Cut the G3 art (sea creatures, items, map elements, effects, decor) from the two asset sheets.

Usage: python3 scripts/art/cut_g3.py [--contact <dir>] [--compare <dir>] [--only <key|folder>,...]  (--only skips manifests)

Each asset is cut from both the PNG sheet and the large JPEG; spec use="png"|"large" (default large) picks the
one written out, after comparing them side by side with --compare.

Reads asset-sheet-{a,b}.png and asset-sheet-{a,b}-large.jpg from requirement/assets/reference/ when they exist,
otherwise from .worktrees/_ops/sheets/ (SWIMQUEST_SHEETS env var overrides both).
Writes public/art/mockup/{marine,items,map,effects,decor}/<key>.png + .webp + manifest.json.
Every crop box is listed in SPECS below (x0, y0, x1, y1 in sheet pixels, 1536x1024).

Two keying modes:
  solid - opaque objects. Background = plane fitted to the crop border (the sheets have a navy
          gradient). Foreground = colour distance above a threshold, connected components that
          sit inside the box, holes filled, 1 px feather, then the navy is un-blended from the
          edge pixels so there is no dark fringe.
  glow  - light effects (splashes, bubbles, glow, compass lines). Alpha is derived from how much
          brighter/different each pixel is than the local navy (colour-to-alpha), and the colour
          is un-blended, so soft glows stay soft and there is no navy box.
Optional per-asset tweaks: erase rects (labels, neighbours), hue filters, keep-largest.
"""
import json
import os
import re
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
REF = os.path.join(ROOT, "requirement", "assets", "reference")
OPS = os.path.join(ROOT, "..", "_ops") if os.path.basename(os.path.dirname(ROOT)) == ".worktrees" else os.path.join(ROOT, ".worktrees", "_ops")
SCRATCH = os.path.join(OPS, "sheets")
OUT = os.path.join(ROOT, "public", "art", "mockup")


def sheet_path(name):
    for d in (os.environ.get("SWIMQUEST_SHEETS"), REF, SCRATCH):
        if d and os.path.exists(os.path.join(d, name)):
            return os.path.join(d, name)
    sys.exit(f"missing {name}: put it in {REF}")


class Sheet:
    """Lazy uint8 sheet; crops are returned as float32 (keeps memory low on the 2576 px JPEGs)."""

    def __init__(self, name):
        self.name, self.arr = name, None

    def __getitem__(self, idx):
        if self.arr is None:
            self.arr = np.asarray(Image.open(sheet_path(self.name)).convert("RGB"))
        return self.arr[idx].astype(np.float32)

    @property
    def shape(self):
        if self.arr is None:
            self.arr = np.asarray(Image.open(sheet_path(self.name)).convert("RGB"))
        return self.arr.shape


def load(name):
    return Sheet(name)


# "a"/"b" are the 1536x1024 PNG sheets; "a-large"/"b-large" are the stakeholder's 2576x1717 JPEG upscales of
# the same art. The large ones are a uniform resize of the PNGs (checked with phase correlation: offset < 0.1 px),
# so every box below is given in PNG pixels and scaled by LARGE for the large sheet.
SHEETS = {"a": load("asset-sheet-a.png"), "b": load("asset-sheet-b.png"),
          "a-large": load("asset-sheet-a-large.jpg"), "b-large": load("asset-sheet-b-large.jpg")}
LARGE = SHEETS["a-large"].shape[1] / SHEETS["a"].shape[1]

# canvas per folder (spec: creatures/decor/effects/items/pins are 256 squares)
CANVAS = {"marine": (256, 256), "items": (256, 256), "map": (256, 256), "effects": (256, 256), "decor": (256, 256)}
PAD = 0.08

SPECS = []


def S(folder, key, sheet, box, mode="solid", vi="", en="", **kw):
    SPECS.append(dict(folder=folder, key=key, sheet=sheet, box=box, mode=mode, vi=vi, en=en, **kw))


# ---------------- marine (sheet B "Sea creatures"; labels sit below each box)
S("marine", "dolphin", "b", (6, 352, 117, 431), vi="Cá heo", en="Dolphin")
S("marine", "sea-turtle", "b", (121, 354, 224, 427), vi="Rùa biển", en="Sea turtle")
S("marine", "ray", "b", (227, 338, 359, 427), vi="Cá đuối", en="Ray")
S("marine", "whale-shark", "b", (363, 333, 494, 430), vi="Cá mập voi", en="Whale shark")
S("marine", "jellyfish", "b", (19, 449, 109, 543), vi="Sứa", en="Jellyfish")
S("marine", "fish-school", "b", (121, 461, 229, 536), vi="Đàn cá", en="School of fish", thr=40, keep="inside", fill=False)
S("marine", "clownfish", "b", (243, 461, 349, 537), vi="Cá hề", en="Clownfish")
S("marine", "tuna", "b", (363, 456, 472, 537), vi="Cá ngừ", en="Tuna")

# ---------------- items (sheet B "Items & power ups" + sheet A "Items & power-ups")
S("items", "coin", "b", (518, 353, 571, 407), vi="Xu", en="Coin")
S("items", "treasure-chest", "b", (591, 354, 646, 406), vi="Rương báu", en="Treasure chest")
S("items", "pearl", "b", (665, 354, 717, 404), vi="Ngọc trai", en="Pearl")
S("items", "treasure-map", "b", (1423, 923, 1519, 1004), vi="Bản đồ kho báu", en="Treasure map", gc=True)
S("items", "star", "b", (808, 354, 860, 406), vi="Ngôi sao", en="Star")
S("items", "seashell", "b", (524, 436, 576, 489), vi="Vỏ sò", en="Seashell")
S("items", "message-bottle", "b", (601, 433, 652, 494), vi="Chai thư", en="Message in a bottle")
S("items", "energy-drink", "a", (763, 602, 825, 692), vi="Nước tăng lực", en="Energy drink", gc=True)
S("items", "med-kit", "a", (840, 607, 905, 690), vi="Hộp cứu thương", en="Med kit", gc=True)
S("items", "fins", "a", (913, 608, 1007, 690), vi="Chân vịt", en="Swim fins", gc=True)
S("items", "goggles", "a", (1013, 615, 1118, 675), vi="Kính bơi", en="Goggles", fill=False, gc=True, use="png")
S("items", "rescue-buoy", "a", (1120, 610, 1205, 690), vi="Phao cứu sinh", en="Rescue buoy", fill=False, gc=True)
S("items", "swim-cap", "a", (1208, 595, 1302, 666), vi="Mũ bơi", en="Swim cap", gc=True)

# ---------------- map elements
S("map", "location-pin", "a", (318, 614, 355, 668), vi="Ghim vị trí", en="Location pin")
S("map", "route-pin-1", "b", (895, 713, 927, 764), vi="Ghim chặng 1", en="Route pin 1")
S("map", "route-pin-2", "b", (979, 699, 1013, 751), vi="Ghim chặng 2", en="Route pin 2", keep="largest")
S("map", "route-pin-3", "b", (938, 733, 974, 781), vi="Ghim chặng 3", en="Route pin 3", keep="largest")
S("map", "route-pin-4", "b", (1031, 693, 1066, 744), vi="Ghim chặng 4", en="Route pin 4", keep="largest")
S("map", "route-dot", "a", (393, 629, 421, 655), vi="Điểm lộ trình", en="Route dot", disk=(405.4, 641.4, 11.6))
S("map", "route-dash", "a", (422, 624, 527, 657), vi="Đường lộ trình nét đứt", en="Dashed route line", keep="inside", fill=False, erase=[(422, 624, 426, 657), (523, 624, 527, 657)])
S("map", "flag", "a", (536, 611, 574, 648), vi="Cờ", en="Flag")
S("map", "checkered-flag", "a", (595, 611, 646, 655), vi="Cờ đích", en="Checkered flag", fill=False)
S("map", "compass-rose", "b", (1143, 618, 1225, 702), mode="glow", vi="La bàn", en="Compass rose",
  erase=[(1176, 618, 1193, 632), (1143, 645, 1159, 668), (1209, 645, 1225, 668), (1176, 687, 1193, 702)])
S("map", "compass-gold", "b", (1343, 924, 1421, 1004), vi="La bàn vàng", en="Gold compass", fill=False, gc=True)
S("map", "buoy", "a", (636, 655, 694, 711), vi="Phao tiêu", en="Buoy", gc=True)
S("map", "ship-helm", "a", (563, 655, 624, 706), vi="Bánh lái tàu", en="Ship's helm", fill=False, gc=True, use="png", erase=[(563, 655, 624, 657)])
S("map", "treasure-chest", "b", (1070, 734, 1116, 779), vi="Rương báu", en="Treasure chest", keep="largest")
S("map", "cloud", "b", (1236, 624, 1301, 677), mode="glow", vi="Mây", en="Cloud")
S("map", "arrow", "b", (1239, 692, 1294, 724), mode="glow", vi="Mũi tên", en="Arrow")

# ---------------- effects (light on navy: colour-to-alpha)
S("effects", "splash-small", "a", (300, 936, 395, 973), mode="glow", vi="Bọt nhỏ", en="Small splash")
S("effects", "splash-small-2", "a", (403, 925, 515, 975), mode="glow", vi="Bọt nhỏ 2", en="Small splash 2")
S("effects", "splash-medium", "a", (520, 905, 662, 975), mode="glow", vi="Bọt vừa", en="Medium splash")
S("effects", "wave", "a", (678, 903, 820, 982), mode="glow", vi="Sóng", en="Wave")
S("effects", "wave-curl", "a", (1407, 594, 1530, 692), mode="glow", vi="Sóng cuộn", en="Curling wave", floor=40)
S("effects", "bubble", "a", (828, 903, 907, 977), mode="glow", vi="Bong bóng", en="Bubbles")
S("effects", "glow", "a", (1038, 916, 1094, 964), mode="glow", vi="Ánh sáng", en="Glow", floor=14)
S("effects", "splash-burst", "a", (925, 905, 1005, 985), mode="glow", vi="Tia nước", en="Water burst")
S("effects", "splash-ring", "a", (1098, 905, 1175, 985), mode="glow", vi="Vòng tia nước", en="Water ring")
S("effects", "wave-trail", "b", (500, 524, 656, 572), mode="glow", vi="Vệt sóng", en="Wave trail")
S("effects", "water-spark", "b", (661, 452, 727, 540), mode="glow", vi="Tia sóng", en="Water spark")
S("effects", "foam-burst", "b", (728, 437, 797, 541), mode="glow", vi="Bọt nước", en="Foam burst")
S("effects", "completion-burst", "b", (800, 437, 872, 543), mode="glow", vi="Hiệu ứng hoàn thành", en="Completion burst")

# ---------------- decor (sheet A "Decorative assets"; objects overlap on a reef, so hue filters split them)
S("decor", "coral", "a", (1192, 910, 1300, 1012), vi="San hô", en="Coral", hue="pink", keep="largest", fill=False)
S("decor", "starfish", "a", (1293, 958, 1353, 1010), vi="Sao biển", en="Starfish", hue="orange", keep="largest", patch=True, use="png")
S("decor", "seaweed", "a", (1335, 900, 1415, 1000), vi="Rong biển", en="Seaweed", hue="green", keep="largest", fill=False)
S("decor", "sea-turtle", "a", (1408, 888, 1536, 963), vi="Rùa biển", en="Sea turtle")
S("decor", "scallop-shell", "a", (1470, 961, 1522, 1003), vi="Vỏ sò điệp", en="Scallop shell", hue="peach", keep="largest", patch=True,
  erase=[(1470, 961, 1475, 1003)])


# ---------------------------------------------------------------- keying helpers
def bg_plane(a, pad_mask=None):
    """Fit a robust per-channel plane to the crop border: the local navy gradient."""
    h, w, _ = a.shape
    ys, xs = np.mgrid[0:h, 0:w]
    border = np.zeros((h, w), bool)
    border[:2], border[-2:], border[:, :2], border[:, -2:] = True, True, True, True
    if pad_mask is not None:
        border &= pad_mask
    px, py, pc = xs[border], ys[border], a[border]
    keep = np.ones(len(px), bool)
    for _ in range(3):
        X = np.stack([px[keep], py[keep], np.ones(keep.sum())], 1)
        coef, *_ = np.linalg.lstsq(X, pc[keep], rcond=None)
        res = np.abs(np.stack([px, py, np.ones(len(px))], 1) @ coef - pc).sum(1)
        keep = res <= np.percentile(res, 65)
    return (np.stack([xs, ys, np.ones_like(xs)], -1).astype(np.float32) @ coef).astype(np.float32)


def fill_holes(m):
    h, w = m.shape
    ff = np.pad(m.astype(np.uint8), 1) * 255
    mask = np.zeros((h + 4, w + 4), np.uint8)
    cv2.floodFill(ff, mask, (0, 0), 128)
    return ff[1:-1, 1:-1] != 128


def hue_mask(a, name):
    hsv = cv2.cvtColor(np.clip(a, 0, 255).astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.int32)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]  # h in 0..179
    if name == "pink":
        return ((h >= 150) | (h <= 6)) & (s > 50) & (v > 90)
    if name == "orange":
        return (h >= 3) & (h <= 22) & (s > 110) & (v > 110)
    if name == "green":
        return (h >= 25) & (h <= 85) & (s > 70) & (v > 60)
    if name == "peach":
        return (((h >= 0) & (h <= 25)) | (h >= 170)) & (s > 25) & (s < 170) & (v > 150)
    raise ValueError(name)


def unblend(a, bg, alpha):
    al = np.clip(alpha, 1e-3, 1)[..., None]
    f = (a - (1 - al) * bg) / al
    return np.clip(f, 0, 255)


def key(spec, large):
    """Key one asset from the PNG sheet (large=False) or the large JPEG (large=True)."""
    A = SHEETS[spec["sheet"] + ("-large" if large else "")]
    k = LARGE if large else 1.0
    x0, y0, x1, y1 = (round(v * k) for v in spec["box"])
    a = A[y0:y1, x0:x1]
    h, w, _ = a.shape
    valid = np.ones((h, w), bool)
    for ex0, ey0, ex1, ey1 in ((round(v * k) for v in e) for e in spec.get("erase", [])):
        valid[max(0, ey0 - y0):max(0, ey1 - y0), max(0, ex0 - x0):max(0, ex1 - x0)] = False
    if "disk" in spec:  # keep only a disk (cx, cy, r in PNG pixels): trims dashes that touch a round marker
        cx, cy, r = (v * k for v in spec["disk"])
        yy, xx = np.mgrid[0:h, 0:w]
        disk = (xx + x0 + 0.5 - cx) ** 2 + (yy + y0 + 0.5 - cy) ** 2 <= r * r
    bg = bg_plane(a, valid if not valid.all() else None)
    diff = a - bg
    if spec["mode"] == "glow":
        # colour-to-alpha against the local navy: alpha = how far the most-lifted channel moved toward 255.
        # Only lighter-than-navy counts (effects are light), so the navy itself can never become a dark patch.
        alpha = (np.maximum(diff, 0) / np.maximum(255 - bg, 1)).max(2)
        floor = spec.get("floor", 28) / 255.0
        alpha = np.clip((alpha - floor) / (1 - floor), 0, 1) ** 0.9
        alpha[~valid] = 0
        rgb = unblend(a, bg, np.maximum(alpha, 0.05))
        # drop isolated specks
        m = (alpha > 0.06).astype(np.uint8)
        n, lab, st, _ = cv2.connectedComponentsWithStats(m)
        alpha[(st[lab, 4] < 3 * k * k) & (lab > 0)] = 0
        return rgb, alpha
    d = np.sqrt((diff ** 2).sum(2))
    thr = spec.get("thr", 34)
    if "disk" in spec:
        valid = valid & disk
    fg = (d > thr) & valid
    if "hue" in spec:
        fg &= hue_mask(a, spec["hue"])
        fg = cv2.morphologyEx(fg.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8)) > 0
    fg = cv2.morphologyEx(fg.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8)) > 0
    n, lab, st, _ = cv2.connectedComponentsWithStats(fg.astype(np.uint8))
    mode = spec.get("keep", "auto")
    sel = np.zeros((h, w), bool)
    if n > 1:
        if mode == "largest":
            sel = lab == 1 + int(np.argmax(st[1:, 4]))
        else:
            big = st[1:, 4].max()
            for i in range(1, n):
                x, y, cw, ch, ar = st[i]
                touches = x == 0 or y == 0 or x + cw >= w or y + ch >= h
                if mode == "inside":
                    if ar >= 4 * k * k and not touches:
                        sel |= lab == i
                elif ar >= max(6 * k * k, big * 0.02) and (not touches or ar == big):
                    sel |= lab == i
    if spec.get("gc"):
        sel = grabcut_refine(a, d, valid, spec.get("gc_thr", 90))
    patch = None
    if spec.get("fill", True):
        filled = fill_holes(sel)
        patch = filled & ~sel
        sel = filled
    else:
        # fill only small enclosed specks so highlights stay solid, but keep real gaps (spokes, lenses)
        holes = fill_holes(sel) & ~sel
        n2, lab2, st2, _ = cv2.connectedComponentsWithStats(holes.astype(np.uint8))
        for i in range(1, n2):
            if st2[i, 4] <= 6 * k * k:
                sel |= lab2 == i
    # soft edge: inside the mask is opaque; the 1px rim follows the colour distance
    inner = cv2.erode(sel.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    ramp = np.clip((d - thr * 0.5) / (thr * 1.2), 0, 1)
    alpha = np.where(inner, 1.0, np.where(sel, np.maximum(ramp, 0.35), 0.0)).astype(np.float32)
    alpha = cv2.GaussianBlur(alpha, (0, 0), 0.6 * k)
    alpha[~cv2.dilate(sel.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)] = 0
    if spec.get("gc"):
        # the background next to the object is its own glow, not the navy plane: inpaint it for un-blending
        hole = cv2.dilate(sel.astype(np.uint8), np.ones((5, 5), np.uint8))
        bg = cv2.inpaint(np.clip(a, 0, 255).astype(np.uint8), hole, 5, cv2.INPAINT_TELEA).astype(np.float32)
    rgb = unblend(a, bg, alpha)
    if spec.get("patch") and patch is not None and patch.any():
        # holes inside the object that the hue/colour key missed: paint them from the surrounding object
        rgb = cv2.inpaint(rgb.astype(np.uint8), patch.astype(np.uint8) * 255, 3, cv2.INPAINT_TELEA).astype(np.float32)
    return rgb, alpha


def grabcut_refine(a, d, valid, thr_hi):
    """GrabCut seeded by a strict colour-distance core: separates an object from its own soft glow."""
    img = np.clip(a, 0, 255).astype(np.uint8)[..., ::-1].copy()
    core = fill_holes((d > thr_hi) & valid)
    n, lab, st, _ = cv2.connectedComponentsWithStats(core.astype(np.uint8))
    if n > 1:
        core = lab == 1 + int(np.argmax(st[1:, 4]))
    sure = cv2.erode(core.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    mask = np.full(d.shape, cv2.GC_PR_BGD, np.uint8)
    mask[cv2.dilate(core.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0] = cv2.GC_PR_FGD
    mask[sure] = cv2.GC_FGD
    mask[~valid] = cv2.GC_BGD
    mask[:2], mask[-2:], mask[:, :2], mask[:, -2:] = cv2.GC_BGD, cv2.GC_BGD, cv2.GC_BGD, cv2.GC_BGD
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(img, mask, None, bgd, fgd, 6, cv2.GC_INIT_WITH_MASK)
    m = (mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8))
    if n > 1:
        big = st[1:, 4].max()
        m = np.isin(lab, [i for i in range(1, n) if st[i, 4] >= big * 0.05])
    return m


def place(rgb, alpha, canvas):
    rgba = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    im = Image.fromarray(rgba, "RGBA")
    bb = Image.fromarray((alpha > 0.04).astype(np.uint8) * 255).getbbox()
    im = im.crop(bb)
    cw, ch = canvas
    s = min(cw * (1 - 2 * PAD) / im.width, ch * (1 - 2 * PAD) / im.height)
    nw, nh = max(1, round(im.width * s)), max(1, round(im.height * s))
    im = im.resize((nw, nh), Image.LANCZOS)
    r, g, b, al = im.split()
    sharp = Image.merge("RGB", (r, g, b)).filter(ImageFilter.UnsharpMask(radius=1.4, percent=60, threshold=2))
    im = Image.merge("RGBA", (*sharp.split(), al))
    out = Image.new("RGBA", canvas, (0, 0, 0, 0))
    out.paste(im, ((cw - nw) // 2, (ch - nh) // 2))
    # zero the colour of fully transparent pixels (smaller files, no hidden navy)
    arr = np.asarray(out).copy()
    arr[arr[..., 3] == 0, :3] = 0
    return Image.fromarray(arr, "RGBA"), bb


def contact(folder, items, dest):
    cell, cols = 132, 6
    rows = (len(items) + cols - 1) // cols
    W, H = cols * cell, rows * cell
    yy, xx = np.indices((H, W))
    chk = (yy // 12 + xx // 12) % 2
    panels = []
    for bg in ("checker", (11, 42, 74), (255, 255, 255)):
        if bg == "checker":
            base = Image.fromarray(np.where(chk[..., None], 200, 150).repeat(3, 2).astype(np.uint8))
        else:
            base = Image.new("RGB", (W, H), bg)
        base = base.convert("RGBA")
        for i, (k, im) in enumerate(items):
            t = im.resize((cell - 4, cell - 4), Image.LANCZOS)
            base.alpha_composite(t, ((i % cols) * cell + 2, (i // cols) * cell + 2))
        panels.append(base)
    sheet = Image.new("RGBA", (W, H * 3 + 16), (40, 40, 40, 255))
    for i, p in enumerate(panels):
        sheet.paste(p, (0, i * (H + 8)))
    sheet.convert("RGB").save(os.path.join(dest, f"{folder}-contact.png"))


def write_compare(rows, dest):
    """PNG cut | large cut, on checker and navy, chosen one outlined; 8 rows per image."""
    os.makedirs(dest, exist_ok=True)
    c = 192
    yy, xx = np.indices((c, c))
    chk = Image.fromarray(np.where(((yy // 8 + xx // 8) % 2)[..., None], 205, 150).repeat(3, 2).astype(np.uint8)).convert("RGBA")
    navy = Image.new("RGBA", (c, c), (11, 42, 74, 255))
    for start in range(0, len(rows), 8):
        part = rows[start:start + 8]
        out = Image.new("RGB", (c * 4, c * len(part)), (60, 60, 60))
        for i, (name, a, b, large) in enumerate(part):
            for j, (im, bg) in enumerate([(a, chk), (a, navy), (b, chk), (b, navy)]):
                t = bg.copy()
                t.alpha_composite(im.resize((c, c), Image.LANCZOS))
                out.paste(t.convert("RGB"), (j * c, i * c))
            x = 2 * c if large else 0
            ImageDraw.Draw(out).rectangle([x, i * c, x + 2 * c - 1, i * c + c - 1], outline=(255, 220, 0), width=3)
            ImageDraw.Draw(out).text((4, i * c + 2), name, fill=(255, 255, 0))
        out.save(os.path.join(dest, f"compare-{start // 8:02d}.png"))


def main():
    contact_dir = None
    if "--contact" in sys.argv:
        contact_dir = sys.argv[sys.argv.index("--contact") + 1]
        os.makedirs(contact_dir, exist_ok=True)
    only = sys.argv[sys.argv.index("--only") + 1].split(",") if "--only" in sys.argv else None
    compare_dir = sys.argv[sys.argv.index("--compare") + 1] if "--compare" in sys.argv else None
    manifests, previews, compare = {}, {}, []
    for spec in SPECS:
        if only and spec["key"] not in only and spec["folder"] not in only:
            continue
        folder = spec["folder"]
        d = os.path.join(OUT, folder)
        os.makedirs(d, exist_ok=True)
        cuts = {}
        for large in (False, True):
            rgb, alpha = key(spec, large)
            cuts[large] = place(rgb, alpha, CANVAS[folder])
        large = spec.get("use", "large") == "large"
        im, bb = cuts[large]
        if compare_dir:
            compare.append((f"{folder}/{spec['key']}", cuts[False][0], cuts[True][0], large))
        png, webp = os.path.join(d, spec["key"] + ".png"), os.path.join(d, spec["key"] + ".webp")
        im.save(png, optimize=True)
        im.save(webp, quality=90, method=6)
        k = LARGE if large else 1.0
        x0, y0 = (round(v * k) for v in spec["box"][:2])
        box = [x0 + bb[0], y0 + bb[1], bb[2] - bb[0], bb[3] - bb[1]]
        manifests.setdefault(folder, []).append(dict(
            key=f"{folder}/{spec['key']}", file=f"/art/mockup/{folder}/{spec['key']}.png", webp=f"/art/mockup/{folder}/{spec['key']}.webp",
            width=im.width, height=im.height, source=f"sheet-{spec['sheet']}" + ("-large" if large else ""), box=box,
            alt=dict(vi=spec["vi"], en=spec["en"])))
        previews.setdefault(folder, []).append((spec["key"], im))
    if compare_dir:
        write_compare(compare, compare_dir)
    if only:
        return
    for folder, m in manifests.items():
        with open(os.path.join(OUT, folder, "manifest.json"), "w", encoding="utf-8") as f:
            # Prettier style (CI runs prettier --check): short arrays/objects on one line
            text = json.dumps(m, indent=2, ensure_ascii=False)
            text = re.sub(r"\[\s+([\d,\s]+?)\s+\]", lambda mm: "[" + ", ".join(mm.group(1).split(",\n")).replace(" ", "").replace(",", ", ") + "]", text)
            f.write(text + "\n")
        if contact_dir:
            contact(folder, previews[folder], contact_dir)
        print(folder, len(m))


if __name__ == "__main__":
    main()
