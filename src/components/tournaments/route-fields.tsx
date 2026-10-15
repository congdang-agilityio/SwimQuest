"use client";

import { useTranslations } from "next-intl";
import { getRoute, listRoutes } from "@/lib/routes";

const control = { minHeight: 44, width: "100%", boxSizing: "border-box", padding: 8 } as const;
const errorStyle = { color: "#b91c1c" } as const;
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

  const a11y = (field: "routeId" | "routeDistanceKm", extra = "") => {
    const described = [extra, errors[field] && `${field}-error`].filter(Boolean).join(" ");
    return {
      "aria-invalid": errors[field] ? true : undefined,
      "aria-describedby": described || undefined,
      style: control,
    };
  };
  const message = (field: "routeId" | "routeDistanceKm") =>
    errors[field] && (
      <span id={`${field}-error`} role="alert" style={errorStyle}>
        {errors[field]}
      </span>
    );

  return (
    <>
      <p>
        <label htmlFor="routeId">{t("fields.route")}</label>
        <select
          id="routeId"
          name="routeId"
          value={route.id}
          onChange={(e) => onChange(e.target.value)}
          {...a11y("routeId")}
        >
          {routes.map((r) => (
            <option key={r.id} value={r.id}>
              {t(`${r.id}.name`)}
            </option>
          ))}
        </select>
        {message("routeId")}
      </p>
      <ol aria-label={t("destinations")}>
        {route.destinations.map((d) => (
          <li key={d.slug}>{name(d.nameKey) + (d.isFinish ? ` (${t("finish")})` : "")}</li>
        ))}
      </ol>
      <p>
        <label htmlFor="routeDistanceKm">{t("fields.routeDistanceKm")}</label>
        <input
          id="routeDistanceKm"
          name="routeDistanceKm"
          type="text"
          inputMode="decimal"
          defaultValue=""
          {...a11y("routeDistanceKm", "routeDistanceKm-hint")}
        />
        <small id="routeDistanceKm-hint">{t("distanceHint")}</small>
        <br />
        {message("routeDistanceKm")}
      </p>
    </>
  );
}
