import { ArtImage } from "@/components/art/art-image";
import { shipArt } from "@/lib/art/route01-art";
import styles from "./voyage.module.css";

type Props = {
  x: number;
  y: number;
  alt: string;
  label: string;
};

const BOX_PCT = 12;

/** The team's tier 1 ship with its progress label (text, not part of the picture). */
export function ShipMarker({ x, y, alt, label }: Props) {
  // The label sits above the ship, anchored to the side with more room, and wraps so it stays
  // inside the map. The box is 12% of the map wide and centred on the ship, so a percentage
  // of the box maps to the free space on the chosen side.
  const rightHalf = x > 50;
  const roomPct = rightHalf ? x + BOX_PCT / 2 : 100 - x + BOX_PCT / 2;
  const maxWidthPct = (roomPct / BOX_PCT) * 100;
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
      <strong
        data-testid="progress-label"
        style={{
          position: "absolute",
          bottom: "100%",
          ...(rightHalf ? { right: 0, textAlign: "right" } : { left: 0 }),
          width: "max-content",
          maxWidth: `${maxWidthPct}%`,
          background: "#fffc",
        }}
      >
        {label}
      </strong>
    </div>
  );
}
