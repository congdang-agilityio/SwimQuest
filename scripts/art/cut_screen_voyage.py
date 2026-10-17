"""Temporary voyage-screen art cut from the stakeholder mockup (#693).

Usage: python3 scripts/art/cut_screen_voyage.py
Needs Pillow, numpy and opencv-python-headless.

Writes public/art/mockup/screen-voyage/:
- map-route01.webp: the Route 01 map scene of the "BẢN ĐỒ HẢI TRÌNH ROUTE 01" panel, 2x LANCZOS,
  18:7 (1348 x 524). The painted pins and name pills stay: the app draws its own pins and pills on
  top at the same anchors (public/art/route01/map-anchors.json). Painted UI with no app
  counterpart is removed: the team card corner, the duplicate "3 Bãi Sơn Thủy" pill, the
  painted compass (the page draws map/compass-rose) and the painted ship (the app draws the
  team's ship).
Swap it for a shared group asset once one exists (no group owns a top-down Route 01 map).
"""

from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
MOCKUP = ROOT / "requirement/assets/reference/swimquest_full_platform_ui_concept.png"
OUT = ROOT / "public/art/mockup/screen-voyage"

# Crop boxes in mockup pixels (1536 x 1024).
MAP_BOX = (612, 432, 1286, 694)  # map scene: below the title row, above the progress band


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

    # Duplicate "3" pill and the painted compass (with its N/E/S/W letters; the page draws the
    # G3 compass-rose instead): inpainted from their surroundings.
    a = cv2.cvtColor(np.array(scene), cv2.COLOR_RGB2BGR)
    hole = np.zeros(a.shape[:2], np.uint8)
    cv2.rectangle(hole, (312, 132), (500, 218), 255, -1)
    cv2.rectangle(hole, (14, 14), (152, 150), 255, -1)
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


def main() -> None:
    im = Image.open(MOCKUP).convert("RGB")
    OUT.mkdir(parents=True, exist_ok=True)
    scene = cut_map(im)
    scene.save(OUT / "map-route01.webp", quality=90)


if __name__ == "__main__":
    main()
