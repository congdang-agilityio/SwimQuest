"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { listRoutes } from "@/lib/routes";
import { defaultSeasonTimes } from "@/lib/time/vn";
import {
  parseTournamentDraft,
  type TournamentDraftErrors,
  type TournamentDraftField,
} from "@/lib/validation/tournament";

const control = { minHeight: 44, width: "100%", boxSizing: "border-box", padding: 8 } as const;
const errorColor = { color: "#b91c1c" };
const routes = listRoutes();

type Season = { date: string; time: string };
const empty: Season = { date: "", time: "" };

export function CreateTournamentForm() {
  const t = useTranslations("tournaments");
  const [errors, setErrors] = useState<TournamentDraftErrors>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [start, setStart] = useState<Season>(empty);
  const [end, setEnd] = useState<Season>(empty);
  const [routeId, setRouteId] = useState(routes[0].id);
  const route = routes.find((r) => r.id === routeId) ?? routes[0];

  /** A picked date pre-fills the default time (00:00 / 23:59) unless a time is already there. */
  function pick(which: "start" | "end", date: string) {
    const set = which === "start" ? setStart : setEnd;
    set((prev) => {
      let time = prev.time;
      if (date && !time) {
        try {
          const d = defaultSeasonTimes(date, date);
          time = which === "start" ? d.start.time : d.end.time;
        } catch {
          /* an incomplete date keeps the time empty */
        }
      }
      return { date, time };
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      name: form.get("name"),
      description: form.get("description"),
      seasonStart: start,
      seasonEnd: end,
      routeId,
      routeDistanceKm: form.get("routeDistanceKm"),
    };
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
        const { id } = (await res.json()) as { id: string };
        window.location.assign(`/tournaments/${encodeURIComponent(id)}/manage`);
        return;
      }
      const fields = res.status === 400 ? (await res.json())?.error?.fields : undefined;
      if (fields && typeof fields === "object") setErrors(fields as TournamentDraftErrors);
      else setFailed(true);
    } catch {
      setFailed(true);
    }
    setBusy(false);
  }

  const err = (field: TournamentDraftField, id: string) => {
    const code = errors[field];
    return {
      input: {
        "aria-invalid": code ? true : undefined,
        "aria-describedby": code ? `${id}-error` : undefined,
      },
      message: code && (
        <span id={`${id}-error`} role="alert" style={errorColor}>
          {t(`errors.${code}`)}
        </span>
      ),
    };
  };
  const name = err("name", "name");
  const description = err("description", "description");
  const seasonStart = err("seasonStart", "seasonStart");
  const seasonEnd = err("seasonEnd", "seasonEnd");
  const routeError = err("routeId", "routeId");
  const distance = err("routeDistanceKm", "routeDistanceKm");

  return (
    <form onSubmit={onSubmit} noValidate aria-label={t("create.title")}>
      <p>
        <label htmlFor="name">{t("create.fields.name")}</label>
        <input id="name" name="name" type="text" style={control} {...name.input} />
        {name.message}
      </p>
      <p>
        <label htmlFor="description">{t("create.fields.description")}</label>
        <textarea
          id="description"
          name="description"
          rows={4}
          style={control}
          {...description.input}
        />
        {description.message}
      </p>
      <fieldset aria-describedby={seasonStart.input["aria-describedby"]}>
        <legend>{t("create.fields.seasonStart")}</legend>
        <label htmlFor="seasonStartDate">{t("create.fields.date")}</label>
        <input
          id="seasonStartDate"
          type="date"
          value={start.date}
          onChange={(e) => pick("start", e.target.value)}
          style={control}
          {...seasonStart.input}
        />
        <label htmlFor="seasonStartTime">{t("create.fields.timeVn")}</label>
        <input
          id="seasonStartTime"
          type="time"
          value={start.time}
          onChange={(e) => setStart({ ...start, time: e.target.value })}
          style={control}
          {...seasonStart.input}
        />
        {seasonStart.message}
      </fieldset>
      <fieldset aria-describedby={seasonEnd.input["aria-describedby"]}>
        <legend>{t("create.fields.seasonEnd")}</legend>
        <label htmlFor="seasonEndDate">{t("create.fields.date")}</label>
        <input
          id="seasonEndDate"
          type="date"
          value={end.date}
          onChange={(e) => pick("end", e.target.value)}
          style={control}
          {...seasonEnd.input}
        />
        <label htmlFor="seasonEndTime">{t("create.fields.timeVn")}</label>
        <input
          id="seasonEndTime"
          type="time"
          value={end.time}
          onChange={(e) => setEnd({ ...end, time: e.target.value })}
          style={control}
          {...seasonEnd.input}
        />
        {seasonEnd.message}
      </fieldset>
      <p>
        <label htmlFor="routeId">{t("create.fields.route")}</label>
        <select
          id="routeId"
          value={routeId}
          onChange={(e) => setRouteId(e.target.value)}
          style={control}
          {...routeError.input}
        >
          {routes.map((r) => (
            <option key={r.id} value={r.id}>
              {t(`routes.${r.id}.name`)}
            </option>
          ))}
        </select>
        {routeError.message}
      </p>
      <ol aria-label={t("create.destinations")}>
        {route.destinations.map((d) => (
          <li key={d.slug}>
            {t(d.nameKey)}
            {d.isFinish ? ` (${t("create.finish")})` : ""}
          </li>
        ))}
      </ol>
      <p>
        <label htmlFor="routeDistanceKm">{t("create.fields.routeDistanceKm")}</label>
        <input
          id="routeDistanceKm"
          name="routeDistanceKm"
          type="text"
          inputMode="decimal"
          style={control}
          aria-describedby={
            distance.input["aria-describedby"]
              ? `routeDistanceKm-hint ${distance.input["aria-describedby"]}`
              : "routeDistanceKm-hint"
          }
          aria-invalid={distance.input["aria-invalid"]}
        />
        <small id="routeDistanceKm-hint">{t("create.distanceHint")}</small>
        <br />
        {distance.message}
      </p>
      {failed && (
        <p role="alert" style={errorColor}>
          {t("errors.GENERIC")}
        </p>
      )}
      <button type="submit" disabled={busy} style={control}>
        {t("create.submit")}
      </button>
    </form>
  );
}
