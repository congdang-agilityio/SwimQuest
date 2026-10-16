import { useTranslations } from "next-intl";
import { ArtImage } from "@/components/art/art-image";
import { landmarkArt, ROUTE01_ART } from "@/lib/art/route01-art";
import styles from "./voyage.module.css";

export type RouteMapProps = {
  routeId: string;
  destinations: { slug: string; x: number; y: number; isFinish: boolean }[];
};

/** Route map base: background and landmarks from the art registry, names as text. */
export function RouteMap({ routeId, destinations }: RouteMapProps) {
  const t = useTranslations();
  const background = ROUTE01_ART.find((a) => a.key === "map");
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
        {destinations.map((d) => (
          <div
            key={d.slug}
            data-testid={`destination-${d.slug}`}
            style={{
              position: "absolute",
              left: `${d.x}%`,
              top: `${d.y}%`,
              transform: "translate(-50%, -50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "14%",
              fontSize: "0.8rem",
            }}
          >
            <ArtImage
              art={landmarkArt(d.slug)}
              alt=""
              className={styles.landmark}
              fallback={<span aria-hidden="true">●</span>}
            />
            <span
              style={{
                background: "#fffd",
                fontWeight: d.isFinish ? 700 : 400,
                textAlign: "center",
              }}
            >
              {t(`routes.${routeId}.${d.slug}`)}
              {d.isFinish && <span data-testid="finish-marker"> ({t("voyage.finish")})</span>}
            </span>
          </div>
        ))}
      </div>
      <p data-testid="map-note">{t("voyage.note")}</p>
    </section>
  );
}
