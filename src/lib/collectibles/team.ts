// Team collectibles (map fragments and treasure chests). Collecting only:
// the result carries no points, progress or spend fields.

export const MAP_FRAGMENT_PERCENTS = [20, 40, 60, 80] as const;
export type MapFragmentPercent = (typeof MAP_FRAGMENT_PERCENTS)[number];

export type TreasureChestKey = "HALFWAY" | "LY_SON";

export const HALFWAY_BP = 5000;

export type TeamCollectibles = {
  mapFragments: MapFragmentPercent[];
  treasureChests: TreasureChestKey[];
  voyageMapComplete: boolean;
};

export function teamCollectibles(input: {
  progressBp: number;
  finished: boolean;
}): TeamCollectibles {
  const { progressBp, finished } = input;
  const mapFragments = MAP_FRAGMENT_PERCENTS.filter((p) => progressBp >= p * 100);
  const treasureChests: TreasureChestKey[] = [];
  if (progressBp >= HALFWAY_BP) treasureChests.push("HALFWAY");
  if (finished) treasureChests.push("LY_SON");
  return {
    mapFragments,
    treasureChests,
    voyageMapComplete: finished && mapFragments.length === MAP_FRAGMENT_PERCENTS.length,
  };
}
