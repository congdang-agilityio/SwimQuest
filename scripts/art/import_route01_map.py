"""Route 01 map art delivered by the stakeholder on 2026-10-18 (#727, #920 section A).

Usage: python3 scripts/art/import_route01_map.py <landscape.png> <portrait.png>
Needs Pillow.

Writes public/art/mockup/map/:
- route01-landscape.{webp,png}: the wide map (desktop and tablet), as delivered (1920 x 819).
- route01-portrait.{webp,png}: the tall map (phones), as delivered (941 x 1672).
Both are opaque, top-down, with no labels or pins: the app draws the pins, names, route and ship
at the anchors in public/art/route01/map-anchors.json (one anchor set per variant).
"""

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/art/mockup/map"


def export(src: str, name: str) -> None:
    im = Image.open(src).convert("RGB")
    im.save(OUT / f"{name}.webp", quality=88, method=6)
    im.save(OUT / f"{name}.png", optimize=True, compress_level=9)
    print(name, im.size)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    export(sys.argv[1], "route01-landscape")
    export(sys.argv[2], "route01-portrait")
