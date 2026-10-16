import { ArtImage } from "@/components/art/art-image";
import { shipArt } from "@/lib/art/route01-art";
import styles from "./voyage.module.css";

type Props = {
  x: number;
  y: number;
  alt: string;
};

// Ship box width as a share of the map width (the progress label CSS relies on it).
const BOX_PCT = 12;

/** The team's tier 1 ship on the map. The progress label is rendered by RouteMap. */
export function ShipMarker({ x, y, alt }: Props) {
  return (
    <div
      data-testid="ship"
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
        art={shipArt(1)}
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
