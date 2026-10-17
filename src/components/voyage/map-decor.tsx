import { ArtImage } from "@/components/art/art-image";
import { mockupArt, toArtAsset } from "@/lib/art/mockup-art";
import styles from "./map-decor.module.css";

/*
 * Marine life and sea decoration (G3 art) at fixed spots in open water on the Route 01 map,
 * clear of the destination pins, their names and the route between them. Purely decorative:
 * hidden from screen readers and not clickable. Position and width are % of the map.
 */
const DECOR: { key: string; x: number; y: number; w: number; flip?: boolean }[] = [
  { key: "marine/dolphin", x: 34, y: 66, w: 6.5 },
  { key: "marine/fish-school", x: 46, y: 84, w: 6 },
  { key: "marine/sea-turtle", x: 71, y: 80, w: 5.5, flip: true },
  { key: "marine/jellyfish", x: 59, y: 75, w: 4 },
  { key: "items/message-bottle", x: 40, y: 54, w: 3.6 },
  { key: "decor/starfish", x: 35, y: 91, w: 3.8 },
  { key: "decor/scallop-shell", x: 57, y: 92, w: 3.6 },
];

export function MapDecor() {
  return (
    <div aria-hidden="true" className={styles.layer} data-testid="map-decor">
      {DECOR.map(({ key, x, y, w, flip }) => {
        const art = mockupArt(key);
        if (!art) return null;
        return (
          <span
            key={key}
            className={styles.item}
            data-flip={flip || undefined}
            style={{ left: `${x}%`, top: `${y}%`, width: `${w}%` }}
          >
            {/* A missing image renders nothing: decoration has no fallback. */}
            <ArtImage art={toArtAsset(art)} alt="" className={styles.image} fallback={null} />
          </span>
        );
      })}
    </div>
  );
}
