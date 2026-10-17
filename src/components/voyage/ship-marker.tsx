import { ArtImage } from "@/components/art/art-image";
import { VOYAGE_SHIP_ART } from "./voyage-art";
import styles from "./voyage.module.css";

type Props = {
  x: number;
  y: number;
  alt: string;
};

// Ship box width as a share of the map width.
const BOX_PCT = 7;

/** The team's ship on the map (art cut from the mockup). The progress label is rendered by RouteMap. */
export function ShipMarker({ x, y, alt }: Props) {
  return (
    <div
      data-testid="ship"
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
      <ArtImage
        art={VOYAGE_SHIP_ART}
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
