"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

const control = { minHeight: 44, minWidth: 44, boxSizing: "border-box", padding: 8 } as const;
const row = { display: "flex", alignItems: "center", gap: 8, minHeight: 44 } as const;

type StartOption = { slug: string; nameKey: string };

type Props = {
  /** Start destinations (never the finish), in route order. */
  starts: readonly StartOption[];
  finish: StartOption | null;
  currentSlug: string | null;
  routeDistanceKm: number;
  /** Members, and everyone after the lock, see the start without choosing. */
  readOnly: boolean;
};

export function StartPicker({ starts, finish, currentSlug, routeDistanceKm, readOnly }: Props) {
  const t = useTranslations();
  const [selected, setSelected] = useState<string | null>(currentSlug);

  return (
    <form noValidate aria-labelledby="start-picker-title">
      <h1 id="start-picker-title">{t("starts.picker.title")}</h1>
      {readOnly && <p>{t("starts.picker.readOnly")}</p>}
      <fieldset>
        <legend>{t("starts.picker.legend")}</legend>
        {starts.map(({ slug, nameKey }) => (
          <label key={slug} style={row}>
            <input
              type="radio"
              name="destination"
              value={slug}
              checked={selected === slug}
              disabled={readOnly}
              onChange={() => setSelected(slug)}
              style={control}
            />
            <span>
              {t(nameKey)} ({t("starts.picker.distance", { km: routeDistanceKm })})
            </span>
          </label>
        ))}
        {finish && (
          <label style={row}>
            <input type="radio" name="destination" value={finish.slug} disabled style={control} />
            <span>
              {t(finish.nameKey)} ({t("starts.picker.finish")})
            </span>
          </label>
        )}
      </fieldset>
      <p>
        <a
          href="/team"
          style={{ display: "inline-flex", alignItems: "center", minHeight: 44, minWidth: 44 }}
        >
          {t("starts.picker.back")}
        </a>
      </p>
    </form>
  );
}
