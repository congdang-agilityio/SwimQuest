"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import styles from "./settings-card.module.css";
import { PointRules, type PointValues } from "@/components/tournaments/rules/point-rules";
import { Button, Field } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";

type Key = keyof PointValues;
type Status = "idle" | "saved" | "locked" | "failed" | "network";

const GROUPS: { id: string; keys: Key[] }[] = [
  { id: "distance", keys: ["pointsPerKm"] },
  {
    id: "bonuses",
    keys: [
      "firstSwimBonusPoints",
      "longSwimTier1M",
      "longSwimTier1Points",
      "longSwimTier2M",
      "longSwimTier2Points",
    ],
  },
  {
    id: "multipliers",
    keys: ["multiplierTwoDaysPct", "multiplierThreeDaysPct", "streakStepPct", "multiplierMaxPct"],
  },
];
const KEYS = GROUPS.flatMap((g) => g.keys);

/** A typed whole number, or null when it is not one. */
const whole = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : null);

/** Organizer form for the point values group; locked (read-only) once the season has started. */
export function PointValuesForm({
  tournamentId,
  values,
  routeDistanceM,
  locked: initiallyLocked,
}: {
  tournamentId: string;
  values: PointValues;
  routeDistanceM: number;
  locked: boolean;
}) {
  const t = useTranslations("settings.points");
  const [typed, setTyped] = useState<Record<Key, string>>(
    () => Object.fromEntries(KEYS.map((k) => [k, String(values[k])])) as Record<Key, string>,
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const locked = initiallyLocked || status === "locked";
  const lockedNote = useRef<HTMLParagraphElement>(null);

  // A 409 removes the focused Save button: move focus to the note so the lock is announced.
  useEffect(() => {
    if (status === "locked") lockedNote.current?.focus();
  }, [status]);

  // The rules text follows what is typed; a value that is not a number yet keeps its saved value.
  const live = Object.fromEntries(
    KEYS.map((k) => [k, whole(typed[k]) ?? values[k]]),
  ) as PointValues;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || locked) return;
    setBusy(true);
    setStatus("idle");
    setErrors({});
    try {
      const res = await clientFetch(
        `/api/tournaments/${encodeURIComponent(tournamentId)}/settings`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ group: "points", values: typed }),
        },
      );
      if (res.ok) {
        setStatus("saved");
      } else if (res.status === 409) {
        setStatus("locked");
      } else if (res.status === 400) {
        const fields = (await res.json().catch(() => null))?.error?.fields;
        const known: Record<string, string> = {};
        if (fields && typeof fields === "object")
          for (const [k, v] of Object.entries(fields))
            if ((KEYS as string[]).includes(k))
              known[k] = typeof v === "string" && t.has(`errors.${v}`) ? v : "UNKNOWN";
        setErrors(known);
        if (Object.keys(known).length === 0) setStatus("failed");
      } else {
        setStatus("failed");
      }
    } catch {
      setStatus("network");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="points-settings-title">
      <h2 id="points-settings-title" className={styles.heading}>
        {t("title")}
      </h2>
      <p className={styles.intro}>{t("intro")}</p>
      {locked && (
        <p ref={lockedNote} role="status" tabIndex={-1} className={styles.lockedNote}>
          {t("locked")}
        </p>
      )}
      {GROUPS.map((group) => (
        <fieldset key={group.id} className={styles.group}>
          <legend className={styles.legend}>{t(`groups.${group.id}`)}</legend>
          {group.keys.map((key) => (
            <Field
              key={key}
              id={key}
              name={key}
              inputMode="numeric"
              label={t(`fields.${key}`)}
              value={typed[key]}
              disabled={locked}
              onChange={(e) => setTyped((s) => ({ ...s, [key]: e.target.value }))}
              error={errors[key] ? t(`errors.${errors[key]}`) : undefined}
            />
          ))}
          {group.id === "multipliers" && <p className={styles.hint}>{t("percentHint")}</p>}
        </fieldset>
      ))}
      <h3 className={styles.subheading}>{t("rulesHeading")}</h3>
      <PointRules values={live} routeDistanceM={routeDistanceM} />
      {!locked && (
        <div className={styles.actions}>
          <Button type="submit" variant="primary" block disabled={busy}>
            {busy ? t("saving") : t("save")}
          </Button>
        </div>
      )}
      {status === "saved" && (
        <p role="status" className={styles.status}>
          {t("saved")}
        </p>
      )}
      {(status === "failed" || status === "network") && (
        <p role="alert" className={styles.failed}>
          {status === "network" ? t("networkError") : t("failed")}
        </p>
      )}
    </form>
  );
}
