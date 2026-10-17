"use client";

import { useTranslations } from "next-intl";
import { MockupPicture } from "@/components/art/mockup-picture";
import { Chip, Field, SelectField } from "@/components/ui";
import { landmarkKey } from "@/lib/art/mockup-art";
import { getRoute, listRoutes } from "@/lib/routes";
import styles from "./create-tournament.module.css";

const routes = listRoutes();

type Props = {
  value: string;
  onChange: (routeId: string) => void;
  /** Already translated messages, shown next to the field. */
  errors?: { routeId?: string; routeDistanceKm?: string };
};

export function RouteFields({ value, onChange, errors = {} }: Props) {
  const t = useTranslations("routes");
  const route = getRoute(value) ?? routes[0];
  // nameKey is `routes.<id>.<slug>`; this component's namespace is already `routes`.
  const name = (key: string) => t(key.replace(/^routes\./, ""));
  const thumb = <span className={styles.thumb} aria-hidden="true" />;

  return (
    <>
      <SelectField
        id="routeId"
        name="routeId"
        label={t("fields.route")}
        value={route.id}
        onChange={(e) => onChange(e.target.value)}
        error={errors.routeId}
      >
        {routes.map((r) => (
          <option key={r.id} value={r.id}>
            {t(`${r.id}.name`)}
          </option>
        ))}
      </SelectField>
      <ol aria-label={t("destinations")} className={styles.stops}>
        {route.destinations.map((d) => {
          const key = landmarkKey(d.slug);
          return (
            <li key={d.slug} className={styles.stop}>
              {key ? (
                <MockupPicture artKey={key} alt="" className={styles.thumb} fallback={thumb} />
              ) : (
                thumb
              )}
              <span className={styles.stopName}>{name(d.nameKey)}</span>
              {d.isFinish && (
                <>
                  <span className={styles.srOnly}> (</span>
                  <Chip tone="gold">{t("finish")}</Chip>
                  <span className={styles.srOnly}>)</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
      <Field
        id="routeDistanceKm"
        name="routeDistanceKm"
        type="text"
        inputMode="decimal"
        defaultValue=""
        label={t("fields.routeDistanceKm")}
        hint={t("distanceHint")}
        error={errors.routeDistanceKm}
      />
    </>
  );
}
