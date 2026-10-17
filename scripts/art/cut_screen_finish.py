#!/usr/bin/env python3
"""Temporary cut for the Finish screen (#695): the HOÀN THÀNH lighthouse emblem from the mockup.

The asset sheets have no HOÀN THÀNH emblem yet (G2 #704 owns badges). Until that lands, this cuts
it from the "7 Cập bến Lý Sơn" phone panel of the mockup, upscales 4x, and keys out the navy by
flood-filling dark pixels from the crop border.

Usage: python3 -I scripts/art/cut_screen_finish.py
Writes public/art/mockup/screen-finish/finish-emblem.png + .webp.
"""
import os
from collections import deque

from PIL import Image, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MOCKUP = os.path.join(ROOT, "requirement/assets/reference/swimquest_full_platform_ui_concept.png")
OUT = os.path.join(ROOT, "public/art/mockup/screen-finish/finish-emblem")
BOX = (1398, 266, 1497, 349)  # x0, y0, x1, y1 in the 1536x1024 mockup
SCALE = 4


def is_navy(p):
    r, g, b = p
    return max(r, g, b) < 115 and r < g + 30


def main():
    im = Image.open(MOCKUP).convert("RGB").crop(BOX)
    im = im.resize((im.width * SCALE, im.height * SCALE), Image.LANCZOS)
    im = im.filter(ImageFilter.UnsharpMask(radius=2, percent=80, threshold=2))
    w, h = im.size
    px = im.load()
    mask = Image.new("L", (w, h), 255)
    m = mask.load()
    seen = bytearray(w * h)
    q = deque([(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)])
    q.extend([(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)])
    while q:
        x, y = q.popleft()
        if seen[y * w + x]:
            continue
        seen[y * w + x] = 1
        if not is_navy(px[x, y]):
            continue
        m[x, y] = 0
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                q.append((nx, ny))
    mask = mask.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    mask = mask.filter(ImageFilter.GaussianBlur(1.2))
    out = im.convert("RGBA")
    out.putalpha(mask)
    out = out.crop(out.getbbox())
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    out.save(OUT + ".png", optimize=True)
    out.save(OUT + ".webp", quality=90, method=6)
    print(OUT, out.size)


if __name__ == "__main__":
    main()
