import { ArtImage } from "@/components/art/art-image";
import { shipArt } from "@/lib/art/route01-art";
import type { ShipTier } from "@/lib/scoring/ship-tier";
import { SwimmerSprite } from "./swimmer-sprite";
import styles from "./voyage.module.css";

type Props = {
  x: number;
  y: number;
  alt: string;
  /** Ship tier from the team's progress (lib/scoring/ship-tier). */
  tier?: ShipTier;
  /** The viewer's swimmer shows the energy orb (weekly multiplier active). */
  energyOrb?: boolean;
};

// Ship box width as a share of the map width.
const BOX_PCT = 11;

/**
 * The team's ship on the map drawn for its current tier (G2 art), with a swimmer gliding beside
 * it. The progress label is rendered by RouteMap.
 */
export function ShipMarker({ x, y, alt, tier = 1, energyOrb = false }: Props) {
  return (
    <div
      data-testid="ship"
      data-tier={tier}
      className={styles.shipMarker}
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: "translate(-50%, -50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: `${BOX_PCT}%`,
      }}
    >
      <SwimmerSprite energyOrb={energyOrb} />
      <ArtImage
        art={shipArt(tier)}
        alt={alt}
        className={styles.ship}
        fallback={
          <span role="img" aria-label={alt} style={{ fontSize: "1.5rem" }}>
            ⛵
          </span>
        }
      />
    </div>
  );
}
