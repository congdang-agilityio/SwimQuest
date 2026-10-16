import { ArtImage } from "@/components/art/art-image";
import { shipArt } from "@/lib/art/route01-art";
import styles from "./voyage.module.css";

type Props = {
  /** Position as percent of the map box. */
  x: number;
  y: number;
  /** Accessible name, e.g. "Cá Mập's ship". */
  alt: string;
  /** Progress text, e.g. "68 / 100 route km · 68%". */
  label: string;
};

/** The team's tier 1 ship with its progress label (text, not part of the picture). */
export function ShipMarker({ x, y, alt, label }: Props) {
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
        width: "12%",
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
      <strong data-testid="progress-label" style={{ whiteSpace: "nowrap", background: "#fffc" }}>
        {label}
      </strong>
    </div>
  );
}
