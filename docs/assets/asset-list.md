# Route 01 art asset list

Source of truth in code: `ROUTE01_ART` in `src/lib/art/route01-art.ts`. Files are served from `public/`.

Source: `cut-out` = real artwork cut out of a photo; `vector stand-in` = simple vector drawn by us, to be replaced; `placeholder` = none yet. Today every asset is a vector stand-in.

General rule for any replacement: keep the same file path (or update the registry), no painted text, transparent background unless it is the map.

| Asset | File path | Source | Size | What a replacement needs |
|---|---|---|---|---|
| Map | `public/art/route01/map.svg` | vector stand-in | 1600x1000 (16:10) | 16:10 map of ocean and coast, no painted text; landmark positions in `public/art/route01/map-anchors.json` |
| Landmark: Non Nuoc | `public/art/route01/landmarks/non_nuoc.svg` | vector stand-in | 128x128 | Transparent square cut-out or art, no text |
| Landmark: Son Thuy | `public/art/route01/landmarks/son_thuy.svg` | vector stand-in | 128x128 | Transparent square cut-out or art, no text |
| Landmark: Pham Van Dong | `public/art/route01/landmarks/pham_van_dong.svg` | vector stand-in | 128x128 | Transparent square cut-out or art, no text |
| Landmark: Man Thai | `public/art/route01/landmarks/man_thai.svg` | vector stand-in | 128x128 | Transparent square cut-out or art, no text |
| Landmark: Hon Sup | `public/art/route01/landmarks/hon_sup.svg` | vector stand-in | 128x128 | Transparent square cut-out or art, no text |
| Landmark: Cu Lao Cham | `public/art/route01/landmarks/cu_lao_cham.svg` | vector stand-in | 128x128 | Transparent square cut-out or art, no text |
| Landmark: Ly Son | `public/art/route01/landmarks/ly_son.svg` | vector stand-in | 128x128 | Transparent square cut-out or art, no text |
| Ship tier 1 | `public/art/ships/ship-tier-1.svg` | vector stand-in | 128x96 (4:3) | Transparent image, bow facing right, readable at 48 px, no text |
| Ship tier 2 | `public/art/ships/ship-tier-2.svg` | vector stand-in | 128x96 (4:3) | Transparent image, bow facing right, readable at 48 px, no text |
| Ship tier 3 | `public/art/ships/ship-tier-3.svg` | vector stand-in | 128x96 (4:3) | Transparent image, bow facing right, readable at 48 px, no text |
