"""Temporary voyage-screen art cut from the stakeholder mockup (#693).

Usage: python3 scripts/art/cut_screen_voyage.py
Needs Pillow, numpy, scipy and opencv-python-headless.

Writes public/art/mockup/screen-voyage/:
- map-route01.webp: the Route 01 map scene of the "BẢN ĐỒ HẢI TRÌNH ROUTE 01" panel, 2x LANCZOS,
  18:7 (1348 x 524). The painted pins and name pills stay: the app draws its own pins and pills on
  top at the same anchors (public/art/route01/map-anchors.json). Painted UI with no app
  counterpart is removed: the team card corner, the duplicate "3 Bãi Sơn Thủy" pill and the
  painted ship (the app draws the team's ship).
- ship-map.png: the painted ship from the same map, sea keyed out.
Swap both for the shared group assets (map: G3, ships: G2) once they are on main.
"""

from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
MOCKUP = ROOT / "requirement/assets/reference/swimquest_full_platform_ui_concept.png"
OUT = ROOT / "public/art/mockup/screen-voyage"

# Crop boxes in mockup pixels (1536 x 1024).
MAP_BOX = (612, 432, 1286, 694)  # map scene: below the title row, above the progress band
SHIP_BOX = (834, 576, 894, 648)  # painted ship on that map


def cut_map(im: Image.Image) -> Image.Image:
    scene = im.crop(MAP_BOX).resize((1348, 524), Image.LANCZOS)

    # Team card corner (top right): islands and sea from just below, mirrored, feathered on the
    # left and bottom only. Boxes below are in 2x scene pixels.
    left = np.array(scene.crop((1040, 84, 1120, 184)))
    right = np.array(scene.crop((960, 84, 1348, 184)))
    card = Image.fromarray(np.hstack([left, right])).transpose(Image.FLIP_TOP_BOTTOM)
    mask = Image.new("L", card.size, 0)
    mask.paste(255, (16, 0, card.size[0], card.size[1] - 16))
    mask = mask.filter(ImageFilter.GaussianBlur(7))
    mask.paste(255, (40, 0, card.size[0], 40))
    scene.paste(card, (880, -16), mask)

    # Duplicate "3" pill: inpainted from its surroundings.
    a = cv2.cvtColor(np.array(scene), cv2.COLOR_RGB2BGR)
    hole = np.zeros(a.shape[:2], np.uint8)
    cv2.rectangle(hole, (312, 132), (500, 218), 255, -1)
    a = cv2.inpaint(a, hole, 15, cv2.INPAINT_NS)
    scene = Image.fromarray(cv2.cvtColor(a, cv2.COLOR_BGR2RGB))

    # Painted ship: open sea from the right of it, feathered.
    x0, y0, x1, y1 = 440, 284, 566, 436
    sea = scene.crop((700, 372, 700 + x1 - x0, 372 + y1 - y0))
    m = Image.new("L", sea.size, 0)
    m.paste(255, (10, 10, sea.size[0] - 10, sea.size[1] - 10))
    m = m.filter(ImageFilter.GaussianBlur(5))
    scene.paste(sea, (x0, y0), m)
    return scene


def cut_ship(im: Image.Image) -> Image.Image:
    ship = im.crop(SHIP_BOX).resize((120, 144), Image.LANCZOS)
    a = np.array(ship).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    water = ((b > r + 40) & (b > 110)) | ((r > 150) & (g > 190) & (b > 210) & (b - r > 10))
    # Only water connected to the border goes, so the navy hull keeps its pixels.
    labels, _ = ndimage.label(water)
    edge = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]])))
    solid = ~np.isin(labels, list(edge - {0}))
    # Keep only the ship (largest piece), dropping stray bits of wake.
    parts, n = ndimage.label(solid)
    if n > 1:
        sizes = ndimage.sum(solid, parts, range(1, n + 1))
        solid = parts == int(np.argmax(sizes)) + 1
    solid = ndimage.binary_fill_holes(solid)
    alpha = Image.fromarray(np.where(solid, 255, 0).astype(np.uint8))
    alpha = alpha.filter(ImageFilter.MedianFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    out = ship.convert("RGBA")
    out.putalpha(alpha)
    return out.crop(out.getbbox())


def main() -> None:
    im = Image.open(MOCKUP).convert("RGB")
    OUT.mkdir(parents=True, exist_ok=True)
    scene = cut_map(im)
    scene.save(OUT / "map-route01.webp", quality=90)
    cut_ship(im).save(OUT / "ship-map.png", optimize=True)


if __name__ == "__main__":
    main()
