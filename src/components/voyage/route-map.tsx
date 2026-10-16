import { useTranslations } from "next-intl";
import { ArtImage } from "@/components/art/art-image";
import { StartOriginLabel } from "@/components/starts/team-start-card";
import { landmarkArt, ROUTE01_ART } from "@/lib/art/route01-art";
import { formatProgressPct } from "@/lib/scoring/progress";
import { ShipMarker } from "./ship-marker";
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

const ASPECT = 1.6; // map box is 16:10; SVG viewBox is 160 x 100
// Names sit right of their icon (open sea), except near the right edge where they would not fit.
const NAME_LEFT_FROM_X = 75;
/** Route map base: background and landmarks from the art registry, names and progress as text. */
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
  const background = ROUTE01_ART.find((a) => a.key === "map");
  const label = t("voyage.progress", {
    reached: progress.routeKmReached,
    total: progress.routeKmTotal,
    pct: formatProgressPct(progress.progressBp),
  });
  return (
    <section aria-label={t("voyage.mapLabel")}>
      <div
        data-testid="route-map"
        style={{ position: "relative", width: "100%", aspectRatio: "16 / 10", overflow: "hidden" }}
      >
        <ArtImage
          art={background}
          alt=""
          className={styles.background}
          fallback={<div style={{ position: "absolute", inset: 0, background: "#bde3f2" }} />}
        />
        {path && (
          <svg
            data-testid="route-path"
            viewBox="0 0 160 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          >
            <polyline
              points={path.map((p) => `${p.x * ASPECT},${p.y}`).join(" ")}
              fill="none"
              stroke="#c2410c"
              strokeWidth={3}
              strokeDasharray="6 4"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
        {destinations.map((d) => (
          <div
            key={d.slug}
            data-testid={`destination-${d.slug}`}
            className={styles.destination}
            style={{ left: `${d.x}%`, top: `${d.y}%` }}
          >
            <ArtImage
              art={landmarkArt(d.slug)}
              alt=""
              className={styles.landmark}
              fallback={<span aria-hidden="true">●</span>}
            />
            <span
              data-testid="landmark-name"
              className={d.x >= NAME_LEFT_FROM_X ? styles.nameLeft : styles.nameRight}
              style={{ fontWeight: start?.slug === d.slug || d.isFinish ? 700 : 400 }}
            >
              {t(`routes.${routeId}.${d.slug}`)}
              {d.isFinish && <span data-testid="finish-marker"> ({t("voyage.finish")})</span>}
            </span>
          </div>
        ))}
        {ship && <ShipMarker x={ship.x} y={ship.y} alt={t("voyage.ship", { team: teamName })} />}
      </div>
      {ship && (
        <strong
          data-testid="progress-label"
          // A caption under the map at every width, so it never covers a destination name.
          className={styles.progressLabel}
        >
          {label}
        </strong>
      )}
      {start ? (
        <p data-testid="start-info">
          {t("voyage.start", { name: t(`routes.${routeId}.${start.slug}`) })}
          {start.automaticAtIso && (
            <>
              {" · "}
              <StartOriginLabel setAtIso={start.automaticAtIso} />
            </>
          )}
        </p>
      ) : (
        <p data-testid="no-start">{t("voyage.noStart")}</p>
      )}
      <p data-testid="map-note">{t("voyage.note")}</p>
    </section>
  );
}
