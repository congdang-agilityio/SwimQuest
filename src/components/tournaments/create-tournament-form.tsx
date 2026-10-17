"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { RouteFields } from "./route-fields";
import styles from "./create-tournament.module.css";
import { Button, Card, Field, TextareaField, controlClass } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import { listRoutes } from "@/lib/routes";
import { defaultSeasonTimes } from "@/lib/time/vn";
import { parseTournamentDraft, type TournamentDraftErrors } from "@/lib/validation/tournament";

const routes = listRoutes();
type Season = { date: string; time: string };
const empty: Season = { date: "", time: "" };

export function CreateTournamentForm() {
  const t = useTranslations("tournaments");
  const [errors, setErrors] = useState<TournamentDraftErrors>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [season, setSeason] = useState({ seasonStart: empty, seasonEnd: empty });
  const [routeId, setRouteId] = useState(routes[0].id);

  /** A picked date pre-fills the default time (00:00 / 23:59) unless a time is already there. */
  function setPart(key: keyof typeof season, patch: Partial<Season>) {
    setSeason((s) => {
      const next = { ...s[key], ...patch };
      if (patch.date && !next.time) {
        const d = defaultSeasonTimes(patch.date, patch.date);
        next.time = (key === "seasonStart" ? d.start : d.end).time;
      }
      return { ...s, [key]: next };
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = { ...Object.fromEntries(form), ...season, routeId };
    const parsed = parseTournamentDraft(body);
    setFailed(false);
    setErrors(parsed.ok ? {} : parsed.errors);
    if (!parsed.ok) return;
    setBusy(true);
    try {
      const res = await clientFetch("/api/tournaments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 201) {
        window.location.assign(`/tournaments/${encodeURIComponent((await res.json()).id)}/manage`);
        return;
      }
      const fields = res.status === 400 ? (await res.json())?.error?.fields : undefined;
      if (fields && typeof fields === "object") {
        const known: Record<string, string> = {};
        for (const [k, v] of Object.entries(fields)) {
          if (typeof v === "string" && t.has(`errors.${v}`)) known[k] = v;
        }
        if (Object.keys(known).length) setErrors(known as TournamentDraftErrors);
        else setFailed(true);
      } else setFailed(true);
    } catch {
      setFailed(true);
    }
    setBusy(false);
  }

  /** Props tying a season input to the group's error message (aria-invalid / aria-describedby). */
  const a11y = (field: "seasonStart" | "seasonEnd") => ({
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? `${field}-error` : undefined,
    className: controlClass,
  });
  const text = (field: keyof TournamentDraftErrors) =>
    errors[field] ? t(`errors.${errors[field]}`) : undefined;

  return (
    <form onSubmit={onSubmit} noValidate aria-label={t("create.title")} className={styles.form}>
      <Card className={styles.card}>
        <h2 className={styles.heading}>{t("create.infoHeading")}</h2>
        <Field
          id="name"
          name="name"
          type="text"
          label={t("create.fields.name")}
          error={text("name")}
        />
        {(["seasonStart", "seasonEnd"] as const).map((key) => (
          <fieldset key={key} className={styles.group}>
            <legend className={styles.legend}>{t(`create.fields.${key}`)}</legend>
            <span className={styles.part}>
              <label htmlFor={`${key}Date`} className={styles.label}>
                {t("create.fields.date")}
              </label>
              <input
                id={`${key}Date`}
                type="date"
                value={season[key].date}
                onChange={(e) => setPart(key, { date: e.target.value })}
                {...a11y(key)}
              />
            </span>
            <span className={styles.part}>
              <label htmlFor={`${key}Time`} className={styles.label}>
                {t("create.fields.timeVn")}
              </label>
              <input
                id={`${key}Time`}
                type="time"
                value={season[key].time}
                onChange={(e) => setPart(key, { time: e.target.value })}
                {...a11y(key)}
              />
            </span>
            {errors[key] && (
              <span id={`${key}-error`} role="alert" className={styles.error}>
                {text(key)}
              </span>
            )}
          </fieldset>
        ))}
        <TextareaField
          id="description"
          name="description"
          rows={3}
          label={t("create.fields.description")}
          error={text("description")}
        />
        <h2 className={styles.heading}>{t("create.routeHeading")}</h2>
        <RouteFields
          value={routeId}
          onChange={setRouteId}
          errors={{ routeId: text("routeId"), routeDistanceKm: text("routeDistanceKm") }}
        />
      </Card>
      {failed && (
        <p role="alert" className={styles.formError}>
          {t("errors.GENERIC")}
        </p>
      )}
      <Button type="submit" variant="primary" block disabled={busy}>
        {t("create.submit")}
      </Button>
    </form>
  );
}
