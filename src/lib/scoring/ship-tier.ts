export type ShipTier = 1 | 2 | 3;

export const SHIP_TIER_2_BP = 3500;
export const SHIP_TIER_3_BP = 7000;

/** Ship tier from the team's current progress in basis points; follows current progress, so a drop lowers the tier. */
export function shipTier(progressBp: number): ShipTier {
  if (!Number.isFinite(progressBp)) return 1;
  if (progressBp >= SHIP_TIER_3_BP) return 3;
  if (progressBp >= SHIP_TIER_2_BP) return 2;
  return 1;
}
