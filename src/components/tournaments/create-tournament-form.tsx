"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
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

const ZALO_REASONS: Record<string, string> = {
  ZALO_NOT_CONFIGURED: "notConfigured",
  ZALO_KEY_REJECTED: "rejected",
  VALIDATION_FAILED: "rejected",
  ZALO_UNREACHABLE: "unreachable",
};

/** Saves the bot key on a new tournament; resolves to the reason key when it fails. */
async function saveZaloKey(tournamentId: string, key: string): Promise<string | null> {
  try {
    const res = await clientFetch(`/api/tournaments/${encodeURIComponent(tournamentId)}/zalo`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key }),
    });
    if (res.ok) return null;
    const code: unknown = (await res.json().catch(() => null))?.error?.code;
    return (typeof code === "string" && ZALO_REASONS[code]) || "failed";
  } catch {
    return "network";
  }
}

/** Edit mode (S-34): the stored values, and which season fields are locked and so read-only. */
export type EditTournament = {
  id: string;
  name: string;
  description: string;
  seasonStart: Season;
  seasonEnd: Season;
  /** Season start is fixed once the season is active. */
  startLocked: boolean;
  /** Season end is fixed once the season has ended. */
  endLocked: boolean;
};

export function CreateTournamentForm({ edit }: { edit?: EditTournament }) {
  const t = useTranslations("tournaments");
  const tZalo = useTranslations("zalo");
  const [errors, setErrors] = useState<TournamentDraftErrors>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const [season, setSeason] = useState({
    seasonStart: edit?.seasonStart ?? empty,
    seasonEnd: edit?.seasonEnd ?? empty,
  });
  const [routeId, setRouteId] = useState(routes[0].id);
  // Kept out of the FormData so the key is never part of the tournament request.
  const [zaloKey, setZaloKey] = useState("");
  /** The tournament exists but its Zalo key was not saved: why, and where to fix it. */
  const [zaloFailure, setZaloFailure] = useState<{ id: string; reason: string } | null>(null);

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
    const parsed = parseTournamentDraft(edit ? { ...body, routeDistanceKm: "1" } : body);
    // The route is not part of an edit, so its errors do not count there.
    const found = parsed.ok ? {} : parsed.errors;
    if (edit) {
      delete found.routeId;
      delete found.routeDistanceKm;
    }
    setFailed(false);
    setConflict(null);
    setZaloFailure(null);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      const res = edit
        ? await clientFetch(`/api/tournaments/${encodeURIComponent(edit.id)}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              name: form.get("name"),
              description: form.get("description"),
              ...(edit.startLocked ? {} : { seasonStart: season.seasonStart }),
              ...(edit.endLocked ? {} : { seasonEnd: season.seasonEnd }),
            }),
          })
        : await clientFetch("/api/tournaments", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });
      if (edit && res.ok) {
        window.location.assign(`/tournaments/${encodeURIComponent(edit.id)}/manage`);
        return;
      }
      if (res.status === 201) {
        const id: string = (await res.json()).id;
        const key = zaloKey.trim();
        // The tournament exists either way; a bad key can be fixed on the Zalo page.
        const reason = key ? await saveZaloKey(id, key) : null;
        if (reason) {
          setZaloKey("");
          setZaloFailure({ id, reason });
          setBusy(false);
          return;
        }
        window.location.assign(`/tournaments/${encodeURIComponent(id)}/manage`);
        return;
      }
      if (edit && res.status === 409) {
        const code = (await res.json().catch(() => null))?.error?.code;
        if (typeof code === "string" && t.has(`edit.conflicts.${code}`)) setConflict(code);
        else setFailed(true);
        setBusy(false);
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
  const lockedKey = (field: "seasonStart" | "seasonEnd") =>
    edit && (field === "seasonStart" ? edit.startLocked : edit.endLocked);
  const a11y = (field: "seasonStart" | "seasonEnd") => ({
    disabled: lockedKey(field) || undefined,
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby":
      [lockedKey(field) && `${field}-locked`, errors[field] && `${field}-error`]
        .filter(Boolean)
        .join(" ") || undefined,
    className: controlClass,
  });
  const text = (field: keyof TournamentDraftErrors) =>
    errors[field] ? t(`errors.${errors[field]}`) : undefined;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label={edit ? t("edit.title") : t("create.title")}
      className={styles.form}
    >
      <Card className={styles.card}>
        <h2 className={styles.heading}>{t("create.infoHeading")}</h2>
        <Field
          id="name"
          name="name"
          type="text"
          label={t("create.fields.name")}
          defaultValue={edit?.name}
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
            {lockedKey(key) && (
              <span id={`${key}-locked`} className={styles.locked}>
                {t(`edit.locked.${key}`)}
              </span>
            )}
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
          defaultValue={edit?.description}
          error={text("description")}
        />
        {!edit && (
          <>
            <h2 className={styles.heading}>{t("create.routeHeading")}</h2>
            <RouteFields
              value={routeId}
              onChange={setRouteId}
              errors={{ routeId: text("routeId"), routeDistanceKm: text("routeDistanceKm") }}
            />
            <h2 className={styles.heading}>{t("create.zaloHeading")}</h2>
            <Field
              id="zaloKey"
              type="password"
              label={t("create.fields.zaloKey")}
              hint={t("create.zaloHint")}
              value={zaloKey}
              onChange={(e) => setZaloKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </>
        )}
      </Card>
      {zaloFailure && (
        <div role="alert" className={styles.formError}>
          <p>{t("create.zaloFailed", { reason: tZalo(`errors.${zaloFailure.reason}`) })}</p>
          <p>
            <Link href={`/tournaments/${encodeURIComponent(zaloFailure.id)}/manage/zalo`}>
              {t("create.zaloFix")}
            </Link>
            {" · "}
            <Link href={`/tournaments/${encodeURIComponent(zaloFailure.id)}/manage`}>
              {t("create.zaloSkip")}
            </Link>
          </p>
        </div>
      )}
      {conflict && (
        <p role="alert" className={styles.formError}>
          {t(`edit.conflicts.${conflict}`)}
        </p>
      )}
      {failed && (
        <p role="alert" className={styles.formError}>
          {t("errors.GENERIC")}
        </p>
      )}
      <Button type="submit" variant="primary" block disabled={busy || Boolean(zaloFailure)}>
        {edit ? t("edit.submit") : t("create.submit")}
      </Button>
    </form>
  );
}
