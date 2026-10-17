export type ArtSource = "cut-out" | "vector";

export type ArtAsset = {
  key: string;
  /** Public URL path, served from `public/`. */
  path: string;
  /** Tried when `path` fails to load, before the caller's fallback (the earlier vector art). */
  fallbackPath?: string;
  source: ArtSource;
  /** What a replacement image must provide. */
  replacementNeed: string;
};

const LANDMARK_SLUGS = [
  "non_nuoc",
  "son_thuy",
  "pham_van_dong",
  "man_thai",
  "hon_sup",
  "cu_lao_cham",
  "ly_son",
] as const;

// Landmark islands cut from asset sheet B (public/art/mockup/landmarks, scripts/art/cut_g1.py).
const LANDMARK_MOCKUP: Record<(typeof LANDMARK_SLUGS)[number], string> = {
  non_nuoc: "landmark-01-non-nuoc",
  son_thuy: "landmark-02-son-thuy",
  pham_van_dong: "landmark-03-pham-van-dong",
  man_thai: "landmark-04-man-thai",
  hon_sup: "landmark-05-hon-sup",
  cu_lao_cham: "landmark-06-cu-lao-cham",
  ly_son: "landmark-07-ly-son",
};

const LANDMARK_NEED = "Transparent square cut-out or art, no text";
const SHIP_NEED = "Transparent square cut-out, readable at 48 px, no text";

export const ROUTE01_ART: readonly ArtAsset[] = [
  {
    key: "map",
    path: "/art/route01/map.svg",
    source: "vector",
    replacementNeed: "16:10 map of ocean and coast, no painted text, anchors in map-anchors.json",
  },
  ...LANDMARK_SLUGS.map((slug): ArtAsset => ({
    key: `landmark-${slug}`,
    path: `/art/mockup/landmarks/${LANDMARK_MOCKUP[slug]}.png`,
    fallbackPath: `/art/route01/landmarks/${slug}.svg`,
    source: "cut-out",
    replacementNeed: LANDMARK_NEED,
  })),
  // Ship tiers cut from asset sheet B (public/art/mockup/ships, scripts/art/cut_g2.py); the
  // earlier vector ships stay as the load fallback.
  ...([1, 2, 3] as const).map((tier): ArtAsset => ({
    key: `ship-tier-${tier}`,
    path: `/art/mockup/ships/ship-tier-${tier}.png`,
    fallbackPath: `/art/ships/ship-tier-${tier}.svg`,
    source: "cut-out",
    replacementNeed: SHIP_NEED,
  })),
];

export function landmarkArt(slug: string): ArtAsset | undefined {
  return ROUTE01_ART.find((a) => a.key === `landmark-${slug}`);
}

export function shipArt(tier: number): ArtAsset | undefined {
  return ROUTE01_ART.find((a) => a.key === `ship-tier-${tier}`);
}
