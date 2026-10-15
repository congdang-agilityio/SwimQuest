"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { RouteFields } from "./route-fields";
import { listRoutes } from "@/lib/routes";
import { defaultSeasonTimes } from "@/lib/time/vn";
import { parseTournamentDraft, type TournamentDraftErrors } from "@/lib/validation/tournament";

const control = { minHeight: 44, width: "100%", boxSizing: "border-box", padding: 8 } as const;
const routes = listRoutes();
type Season = { date: string; time: string };
const empty: Season = { date: "", time: "" };
/** Codes the form can translate; anything else from the server falls back to GENERIC. */
const KNOWN_CODES = new Set([
  "NAME_REQUIRED",
  "NAME_TOO_LONG",
  "DESCRIPTION_REQUIRED",
  "DESCRIPTION_TOO_LONG",
  "SEASON_START_INVALID",
  "SEASON_END_INVALID",
  "SEASON_END_NOT_AFTER_START",
  "ROUTE_UNKNOWN",
  "ROUTE_DISTANCE_REQUIRED",
  "ROUTE_DISTANCE_INVALID",
  "ROUTE_DISTANCE_NOT_POSITIVE",
  "ROUTE_DISTANCE_TOO_PRECISE",
  "ROUTE_DISTANCE_TOO_LARGE",
]);

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
      const res = await fetch("/api/tournaments", {
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
          if (typeof v === "string" && KNOWN_CODES.has(v)) known[k] = v;
        }
        if (Object.keys(known).length) setErrors(known as TournamentDraftErrors);
        else setFailed(true);
      } else setFailed(true);
    } catch {
      setFailed(true);
    }
    setBusy(false);
  }

  /** Props tying an input to its error message (aria-invalid / aria-describedby) and the message. */
  const a11y = (field: keyof TournamentDraftErrors, extra = "") => {
    const code = errors[field];
    const described = [extra, code && `${field}-error`].filter(Boolean).join(" ");
    return {
      "aria-invalid": code ? true : undefined,
      "aria-describedby": described || undefined,
      style: control,
    };
  };
  const message = (field: keyof TournamentDraftErrors): ReactNode =>
    errors[field] && (
      <span id={`${field}-error`} role="alert" style={{ color: "#b91c1c" }}>
        {t(`errors.${errors[field]}`)}
      </span>
    );

  return (
    <form onSubmit={onSubmit} noValidate aria-label={t("create.title")}>
      <p>
        <label htmlFor="name">{t("create.fields.name")}</label>
        <input id="name" name="name" type="text" {...a11y("name")} />
        {message("name")}
      </p>
      <p>
        <label htmlFor="description">{t("create.fields.description")}</label>
        <textarea id="description" name="description" rows={4} {...a11y("description")} />
        {message("description")}
      </p>
      {(["seasonStart", "seasonEnd"] as const).map((key) => (
        <fieldset key={key}>
          <legend>{t(`create.fields.${key}`)}</legend>
          <label htmlFor={`${key}Date`}>{t("create.fields.date")}</label>
          <input
            id={`${key}Date`}
            type="date"
            value={season[key].date}
            onChange={(e) => setPart(key, { date: e.target.value })}
            {...a11y(key)}
          />
          <label htmlFor={`${key}Time`}>{t("create.fields.timeVn")}</label>
          <input
            id={`${key}Time`}
            type="time"
            value={season[key].time}
            onChange={(e) => setPart(key, { time: e.target.value })}
            {...a11y(key)}
          />
          {message(key)}
        </fieldset>
      ))}
      <RouteFields
        value={routeId}
        onChange={setRouteId}
        errors={{
          routeId: errors.routeId && t(`errors.${errors.routeId}`),
          routeDistanceKm: errors.routeDistanceKm && t(`errors.${errors.routeDistanceKm}`),
        }}
      />
      {failed && (
        <p role="alert" style={{ color: "#b91c1c" }}>
          {t("errors.GENERIC")}
        </p>
      )}
      <button type="submit" disabled={busy} style={control}>
        {t("create.submit")}
      </button>
    </form>
  );
}
