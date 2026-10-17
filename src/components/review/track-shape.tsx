import styles from "./review.module.css";

const SIZE = 100;
const PAD = 6;

/**
 * The swim's shape as an SVG line: points are projected and scaled into a fixed box, so no
 * coordinates, scale or map tiles reach the page. For the tournament's reviewers only (S-43 AC 5).
 */
export function TrackShape({
  track,
  label,
  emptyLabel,
}: {
  track: { lat: number; lon: number }[];
  label: string;
  emptyLabel: string;
}) {
  if (track.length < 2) {
    return (
      <div className={styles.shape}>
        <p className={styles.noShape}>{emptyLabel}</p>
      </div>
    );
  }
  const midLat = track.reduce((sum, p) => sum + p.lat, 0) / track.length;
  const k = Math.cos((midLat * Math.PI) / 180);
  const xy = track.map((p) => [p.lon * k, -p.lat] as const);
  const xs = xy.map(([x]) => x);
  const ys = xy.map(([, y]) => y);
  const [minX, minY] = [Math.min(...xs), Math.min(...ys)];
  const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) || 1;
  const scale = (SIZE - 2 * PAD) / span;
  const offX = (SIZE - (Math.max(...xs) - minX) * scale) / 2;
  const offY = (SIZE - (Math.max(...ys) - minY) * scale) / 2;
  const pts = xy.map(([x, y]) => [(x - minX) * scale + offX, (y - minY) * scale + offY]);
  const [start, end] = [pts[0]!, pts[pts.length - 1]!];
  return (
    <div className={styles.shape}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={label} className={styles.svg}>
        <polyline
          points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}
          className={styles.line}
        />
        <circle cx={start[0]} cy={start[1]} r={2.5} className={styles.start} />
        <circle cx={end[0]} cy={end[1]} r={2.5} className={styles.end} />
      </svg>
    </div>
  );
}
