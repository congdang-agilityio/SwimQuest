import { useTranslations } from "next-intl";
import { ArtImage } from "@/components/art/art-image";
import { StartOriginLabel } from "@/components/starts/team-start-card";
import { ProgressBar } from "@/components/ui";
import { MAP_ASPECT } from "@/lib/routes/destinations-passed";
import { formatProgressPct } from "@/lib/scoring/progress";
import { ScrollToShip } from "./scroll-to-ship";
import { ShipMarker } from "./ship-marker";
import { VOYAGE_MAP_ART, VOYAGE_SHIP_ART } from "./voyage-art";
import styles from "./voyage.module.css";

export type RouteMapProps = {
  routeId: string;
  teamName: string;
  destinations: { slug: string; x: number; y: number; isFinish: boolean }[];
  path: { x: number; y: number }[] | null;
  start: { slug: string; automaticAtIso: string | null } | null;
  progress: { progressBp: number; routeKmReached: number; routeKmTotal: number };
  ship: { x: number; y: number } | null;
};

// Names sit right of their pin, as on the mockup map; near the right edge they sit above it.
const NAME_ABOVE_FROM_X = 85;

/** Share (0..100) of the path length at each path point, for the dots on the route bar. */
function pathShares(path: { x: number; y: number }[]): number[] {
  const cumulative = [0];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    cumulative.push(cumulative[i - 1] + Math.hypot((b.x - a.x) * MAP_ASPECT, b.y - a.y));
  }
  const total = cumulative[cumulative.length - 1];
  return cumulative.map((c) => (total === 0 ? 0 : (c / total) * 100));
}

/**
 * Route map: the painted Route 01 scene cut from the mockup, numbered pins and name pills at the
 * anchors (which sit on the painted islands), the team ship, and the progress band under the map.
 */
export function RouteMap({
  routeId,
  teamName,
  destinations,
  path,
  start,
  progress,
  ship,
}: RouteMapProps) {
  const t = useTranslations();
  const label = t("voyage.progress", {
    reached: progress.routeKmReached,
    total: progress.routeKmTotal,
    pct: formatProgressPct(progress.progressBp),
  });
  const pct = Math.min(100, Math.max(0, progress.progressBp / 100));
  const finish = destinations.find((d) => d.isFinish);
  return (
    <section aria-label={t("voyage.mapLabel")} className={styles.section}>
      <div className={styles.frame}>
        {/* On a phone the wide map scrolls sideways instead of shrinking its names. */}
        <div className={styles.mapScroll} data-map-scroll>
          {ship && <ScrollToShip />}
          <div
            data-testid="route-map"
            className={styles.map}
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "18 / 7",
              overflow: "hidden",
            }}
          >
            <ArtImage
              art={VOYAGE_MAP_ART}
              alt=""
              className={styles.background}
              fallback={<div className={styles.backgroundFallback} />}
            />
            {path && (
              <svg
                data-testid="route-path"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
                className={styles.path}
              >
                <polyline
                  points={path.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeDasharray="1 7"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            )}
            {destinations.map((d, i) => (
              <div
                key={d.slug}
                data-testid={`destination-${d.slug}`}
                className={styles.destination}
                data-start={start?.slug === d.slug || undefined}
                data-finish={d.isFinish || undefined}
                style={{ left: `${d.x}%`, top: `${d.y}%` }}
              >
                {/* The landmark itself is painted on the map art; the pin shows the route order. */}
                <span aria-hidden="true" className={styles.pin}>
                  {i + 1}
                </span>
                <span className={d.x >= NAME_ABOVE_FROM_X ? styles.nameAbove : styles.nameRight}>
                  <span data-testid="landmark-name" className={styles.name}>
                    {t(`routes.${routeId}.${d.slug}`)}
                    {d.isFinish && <span data-testid="finish-marker"> ({t("voyage.finish")})</span>}
                  </span>
                  <span className={styles.province}>({t(`voyage.province.${d.slug}`)})</span>
                </span>
              </div>
            ))}
            {ship && (
              <ShipMarker x={ship.x} y={ship.y} alt={t("voyage.ship", { team: teamName })} />
            )}
          </div>
        </div>
        {ship && path && (
          <>
            <div className={styles.bandBar}>
              <ProgressBar value={pct} label={t("voyage.routeProgress")} tone="gold" />
              {pathShares(path).map((share, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  className={styles.bandDot}
                  data-passed={share <= pct || undefined}
                  style={{ left: `${share}%` }}
                />
              ))}
              <span className={styles.bandShip} style={{ left: `${pct}%` }}>
                <ArtImage
                  art={VOYAGE_SHIP_ART}
                  alt=""
                  fallback={<span aria-hidden="true">⛵</span>}
                />
              </span>
            </div>
            <strong
              data-testid="progress-label"
              // A caption in the band under the map, so it never covers a destination name (#619).
              className={styles.progressLabel}
            >
              {label}
            </strong>
            {start && (
              <span className={styles.bandStart}>
                {t(`routes.${routeId}.${start.slug}`)} ({t("voyage.bandStart")})
              </span>
            )}
            {finish && (
              <span className={styles.bandFinish}>
                <strong>{t(`routes.${routeId}.${finish.slug}`)}</strong>
                <span>({t("voyage.bandFinish")})</span>
              </span>
            )}
          </>
        )}
      </div>
      {start ? (
        <p data-testid="start-info" className={styles.meta}>
          {t("voyage.start", { name: t(`routes.${routeId}.${start.slug}`) })}
          {start.automaticAtIso && (
            <>
              {" · "}
              <StartOriginLabel setAtIso={start.automaticAtIso} />
            </>
          )}
        </p>
      ) : (
        <p data-testid="no-start" className={styles.meta}>
          {t("voyage.noStart")}
        </p>
      )}
      <p data-testid="map-note" className={styles.note}>
        {t("voyage.note")}
      </p>
    </section>
  );
}
