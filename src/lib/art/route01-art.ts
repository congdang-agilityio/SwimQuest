export type ArtSource = "cut-out" | "vector";

export type ArtAsset = {
  key: string;
  /** Public URL path, served from `public/`. */
  path: string;
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

const LANDMARK_NEED = "Transparent square cut-out or art, no text";
const SHIP_NEED = "Transparent 128x96 (4:3) image, bow facing right, readable at 48 px, no text";

export const ROUTE01_ART: readonly ArtAsset[] = [
  {
    key: "map",
    path: "/art/route01/map.svg",
    source: "vector",
    replacementNeed: "16:10 map of ocean and coast, no painted text, anchors in map-anchors.json",
  },
  ...LANDMARK_SLUGS.map((slug): ArtAsset => ({
    key: `landmark-${slug}`,
    path: `/art/route01/landmarks/${slug}.svg`,
    source: "vector",
    replacementNeed: LANDMARK_NEED,
  })),
  ...([1, 2, 3] as const).map((tier): ArtAsset => ({
    key: `ship-tier-${tier}`,
    path: `/art/ships/ship-tier-${tier}.svg`,
    source: "vector",
    replacementNeed: SHIP_NEED,
  })),
];

export function landmarkArt(slug: string): ArtAsset | undefined {
  return ROUTE01_ART.find((a) => a.key === `landmark-${slug}`);
}

export function shipArt(tier: number): ArtAsset | undefined {
  return ROUTE01_ART.find((a) => a.key === `ship-tier-${tier}`);
}
