import type { MapFragmentPercent, TreasureChestKey } from "@/lib/collectibles/team";

/** Art keys (see `mockupArt`) of the collectibles; collecting only, no effect on the race. */
export const COLLECTIBLE_ART = {
  mapFragment: "items/treasure-map",
  treasureChest: "items/treasure-chest",
  pearl: "items/pearl",
  starfish: "decor/starfish",
  coin: "items/coin",
  energyOrb: "effects/glow",
} as const;

export type CollectibleArtKey = (typeof COLLECTIBLE_ART)[keyof typeof COLLECTIBLE_ART];

/** The one-time moment key of a team's treasure chest, as stored in `SeenMoment`. */
export const chestMomentKey = (teamId: string, chest: TreasureChestKey): string =>
  `chest:${teamId}:${chest}`;

export type { MapFragmentPercent, TreasureChestKey };
