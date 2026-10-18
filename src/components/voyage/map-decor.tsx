import type { CSSProperties } from "react";
import { ArtImage } from "@/components/art/art-image";
import { mockupArt, toArtAsset } from "@/lib/art/mockup-art";
import styles from "./map-decor.module.css";

/*
 * Marine life and sea decoration (G3 art) at fixed spots in open water on the Route 01 map,
 * clear of the destination pins, their names and the route between them. Purely decorative:
 * hidden from screen readers and not clickable. Position and width are % of the map: `x, y, w`
 * on the wide map, `p` on the tall phone map (no `p`: not shown on phones).
 */
const DECOR: {
  key: string;
  x: number;
  y: number;
  w: number;
  p?: [number, number, number];
  flip?: boolean;
}[] = [
  { key: "marine/dolphin", x: 53, y: 66, w: 5, p: [60, 64, 11] },
  { key: "marine/fish-school", x: 30, y: 89, w: 5, p: [88, 79, 10] },
  { key: "marine/sea-turtle", x: 66, y: 83, w: 4.5, p: [50, 89, 9], flip: true },
  { key: "marine/jellyfish", x: 58, y: 91, w: 3 },
  { key: "items/message-bottle", x: 21, y: 64, w: 2.8, p: [60, 53, 6] },
  { key: "decor/starfish", x: 45, y: 93, w: 3 },
  { key: "decor/scallop-shell", x: 63, y: 95, w: 3 },
];

export function MapDecor() {
  return (
    <div aria-hidden="true" className={styles.layer} data-testid="map-decor">
      {DECOR.map(({ key, x, y, w, p, flip }) => {
        const art = mockupArt(key);
        if (!art) return null;
        return (
          <span
            key={key}
            className={styles.item}
            data-flip={flip || undefined}
            data-wide-only={!p || undefined}
            style={
              {
                left: `${x}%`,
                top: `${y}%`,
                width: `${w}%`,
                ...(p && { "--px": `${p[0]}%`, "--py": `${p[1]}%`, "--pw": `${p[2]}%` }),
              } as CSSProperties
            }
          >
            {/* A missing image renders nothing: decoration has no fallback. */}
            <ArtImage art={toArtAsset(art)} alt="" className={styles.image} fallback={null} />
          </span>
        );
      })}
    </div>
  );
}
