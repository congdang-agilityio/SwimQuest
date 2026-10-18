import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { ArtImage } from "@/components/art/art-image";
import { StartOriginLabel } from "@/components/starts/team-start-card";
import { ProgressBar } from "@/components/ui";
import { shipArt } from "@/lib/art/route01-art";
import { MAP_ASPECT, mapLayout, type LabelSide } from "@/lib/routes/map-layout";
import { mirrorAlongPath } from "@/lib/routes/path-position";
import { formatProgressPct } from "@/lib/scoring/progress";
import { shipTier } from "@/lib/scoring/ship-tier";
import { MapArt } from "./map-art";
import { MapDecor } from "./map-decor";
import { ShipMarker } from "./ship-marker";
import { compassArt, voyageMapArt } from "./voyage-art";
import styles from "./voyage.module.css";

export type RouteMapProps = {
  routeId: string;
  teamName: string;
  destinations: { slug: string; x: number; y: number; isFinish: boolean }[];
  path: { x: number; y: number }[] | null;
  start: { slug: string; automaticAtIso: string | null } | null;
  progress: { progressBp: number; routeKmReached: number; routeKmTotal: number };
  ship: { x: number; y: number } | null;
  /** The viewer's weekly multiplier is active: their swimmer shows the energy orb. */
  energyOrb?: boolean;
};

/*
 * Name pill placement around the pin: the pill's own anchor point (percent of its size, x then y)
 * and which gap it keeps from the pin centre, x then y (r/l/u/d: right, left, up, down; pin: the
 * plain pin gap, for the diagonal sides that clear the pin vertically). See .label.
 */
type Gap = "r" | "l" | "u" | "d" | "-pin" | "+pin" | null;
const SIDE: Record<LabelSide, [number, number, Gap, Gap]> = {
  right: [0, 50, "r", null],
  left: [100, 50, "l", null],
  above: [50, 100, null, "u"],
  below: [50, 0, null, "d"],
  "above-right": [0, 100, "-pin", "u"],
  "above-left": [100, 100, "+pin", "u"],
  "below-right": [0, 0, "-pin", "d"],
  "below-left": [100, 0, "+pin", "d"],
};

function gapCss(gap: Gap): string {
  if (gap === null) return "0px";
  if (gap === "+pin") return "var(--gap-pin)";
  if (gap === "-pin") return "calc(-1 * var(--gap-pin))";
  return gap === "r" || gap === "d" ? `var(--gap-${gap})` : `calc(-1 * var(--gap-${gap}))`;
}

function sideVars(prefix: "l" | "p", side: LabelSide | undefined): Record<string, string | number> {
  const [ax, ay, gx, gy] = SIDE[side ?? "right"];
  return {
    [`--${prefix}ax`]: ax,
    [`--${prefix}ay`]: ay,
    [`--${prefix}dx`]: gapCss(gx),
    [`--${prefix}dy`]: gapCss(gy),
  };
}

/*
 * The ship box is centred on its point: 11% (wide map) or 21% (tall map) of the map width, 3:4 tall,
 * with the swimmer trailing on its left. A destination under it keeps its name clear of the ship.
 */
function shipNear(
  ship: { x: number; y: number } | null | undefined,
  d: { x: number; y: number },
  boxPct: number,
  aspect: number,
): boolean {
  if (!ship) return false;
  const dx = Math.abs(ship.x - d.x);
  const dyCqw = Math.abs(ship.y - d.y) / aspect;
  return dx < boxPct * 0.6 && dyCqw < boxPct * 0.45;
}

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
 * Route map: the Route 01 map art (wide from 768 px, tall on phones), numbered pins and name pills
 * at the anchors of the variant on screen (they sit on its islands), the route between them, the
 * team ship, and the progress band under the map. Inline positions are the wide map's; on phones
 * the CSS switches to the tall map's, passed as custom properties.
 */
export function RouteMap({
  routeId,
  teamName,
  destinations,
  path,
  start,
  progress,
  ship,
  energyOrb = false,
}: RouteMapProps) {
  const t = useTranslations();
  const label = t("voyage.progress", {
    reached: progress.routeKmReached,
    total: progress.routeKmTotal,
    pct: formatProgressPct(progress.progressBp),
  });
  const pct = Math.min(100, Math.max(0, progress.progressBp / 100));
  const finish = destinations.find((d) => d.isFinish);
  const tier = shipTier(progress.progressBp);
  const layout = mapLayout(routeId);
  const portrait = layout?.portrait;
  const mapArt = layout
    ? voyageMapArt({ landscape: layout.landscape.art, portrait: layout.portrait.art })
    : undefined;
  // The same stretch of route on the tall map, from the team's start to the finish.
  const startIndex = start ? destinations.findIndex((d) => d.slug === start.slug) : -1;
  const portraitPath =
    portrait && path && startIndex >= 0
      ? destinations.slice(startIndex).map((d) => portrait.anchors[d.slug])
      : null;
  const portraitShip =
    ship &&
    path &&
    portraitPath &&
    portraitPath.length === path.length &&
    portraitPath.every(Boolean)
      ? mirrorAlongPath(path, portraitPath, pct / 100, MAP_ASPECT)
      : undefined;
  return (
    <section aria-label={t("voyage.mapLabel")} className={styles.section}>
      <div className={styles.frame}>
        <div className={styles.mapBox}>
          <div
            data-testid="route-map"
            className={styles.map}
            style={
              {
                position: "relative",
                width: "100%",
                aspectRatio: layout?.landscape.aspectRatio ?? "1920 / 819",
                overflow: "hidden",
                "--ratio-p": portrait?.aspectRatio ?? "941 / 1672",
              } as CSSProperties
            }
          >
            <MapArt
              landscape={mapArt?.landscape}
              portrait={mapArt?.portrait}
              className={styles.background}
              fallback={<div className={styles.backgroundFallback} />}
            />
            <ArtImage art={compassArt()} alt="" className={styles.compass} fallback={null} />
            {/* Marine life and decoration (G3), under the route, the pins and the ship. */}
            <MapDecor />
            {path && (
              <svg
                data-testid="route-path"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
                className={styles.path}
              >
                <polyline
                  className={styles.pathLandscape}
                  points={path.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeDasharray="1 7"
                  vectorEffect="non-scaling-stroke"
                />
                {portraitPath && (
                  <polyline
                    className={styles.pathPortrait}
                    points={portraitPath.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeDasharray="1 7"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>
            )}
            {destinations.map((d, i) => {
              const p = portrait?.anchors[d.slug] ?? d;
              return (
                <div
                  key={d.slug}
                  data-testid={`destination-${d.slug}`}
                  className={styles.destination}
                  data-start={start?.slug === d.slug || undefined}
                  data-finish={d.isFinish || undefined}
                  data-ship-l={
                    shipNear(ship, d, 11, layout?.landscape.aspect ?? MAP_ASPECT) || undefined
                  }
                  data-ship-p={
                    (portrait && shipNear(portraitShip, p, 21, portrait.aspect)) || undefined
                  }
                  style={
                    {
                      left: `${d.x}%`,
                      top: `${d.y}%`,
                      "--px": `${p.x}%`,
                      "--py": `${p.y}%`,
                      ...sideVars("l", layout?.landscape.labels[d.slug]),
                      ...sideVars("p", portrait?.labels[d.slug]),
                    } as CSSProperties
                  }
                >
                  {/* The numbered pin shows the route order; the island is painted on the map. */}
                  <span aria-hidden="true" className={styles.pin}>
                    {i + 1}
                  </span>
                  <span className={styles.label}>
                    <span data-testid="landmark-name" className={styles.name}>
                      {t(`routes.${routeId}.${d.slug}`)}
                      {d.isFinish && (
                        <span data-testid="finish-marker"> ({t("voyage.finish")})</span>
                      )}
                    </span>
                    <span className={styles.province}>({t(`voyage.province.${d.slug}`)})</span>
                  </span>
                </div>
              );
            })}
            {ship && (
              <ShipMarker
                x={ship.x}
                y={ship.y}
                portrait={portraitShip}
                alt={t("voyage.ship", { team: teamName })}
                tier={tier}
                energyOrb={energyOrb}
              />
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
                  art={shipArt(tier)}
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
