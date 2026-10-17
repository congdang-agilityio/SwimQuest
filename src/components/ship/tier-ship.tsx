import { mockupArt } from "@/lib/art/mockup-art";
import { shipTier } from "@/lib/scoring/ship-tier";

type Props = {
  /** The team's current progress in basis points; the tier follows it (lib/scoring/ship-tier). */
  progressBp: number;
  /** Alt text naming the tier, from messages. */
  alt: (tier: number) => string;
  /** `small` is the row variant of the same ship. */
  size?: number;
  small?: boolean;
  className?: string;
};

/** The team's ship drawn for its current tier, cut from asset sheet B (G2 ships/ship-tier-<n>). */
export function TierShip({ progressBp, alt, size = 40, small = false, className }: Props) {
  const tier = shipTier(progressBp);
  const art = mockupArt(`ships/ship-tier-${tier}${small ? "-small" : ""}`);
  if (!art) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small static art cut from the mockup
    <img
      src={art.webp}
      alt={alt(tier)}
      width={size}
      height={size}
      data-testid="tier-ship"
      data-tier={tier}
      className={className}
    />
  );
}
