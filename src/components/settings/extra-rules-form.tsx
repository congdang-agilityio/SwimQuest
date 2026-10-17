"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import styles from "./settings-card.module.css";
import { ExtraRules } from "@/components/tournaments/rules/extra-rules";
import { Button, Field } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import { formatPace, parsePace } from "@/lib/validation/settings/extra-rules";

type Status = "idle" | "saved" | "locked" | "failed" | "network";
type Stored = { minSwimDistanceM: number | null; extraSlowestPaceSecPer100m: number | null };

/** A typed whole number, or null when empty or not one. */
const whole = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : null);

/** Organizer form for the extra swim rules (both optional, empty = off); read-only once the season starts. */
export function ExtraRulesForm({
  tournamentId,
  values,
  slowestPaceSecPer100m,
  locked: initiallyLocked,
}: {
  tournamentId: string;
  values: Stored;
  /** The tournament's realistic slowest pace: the extra pace has to be faster. */
  slowestPaceSecPer100m: number;
  locked: boolean;
}) {
  const t = useTranslations("settings.extraRules");
  const [distance, setDistance] = useState(
    values.minSwimDistanceM === null ? "" : String(values.minSwimDistanceM),
  );
  const [pace, setPace] = useState(
    values.extraSlowestPaceSecPer100m === null ? "" : formatPace(values.extraSlowestPaceSecPer100m),
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [realisticPace, setRealisticPace] = useState("");
  const locked = initiallyLocked || status === "locked";
  const lockedNote = useRef<HTMLParagraphElement>(null);

  // A 409 removes the focused Save button: move focus to the note so the lock is announced.
  useEffect(() => {
    if (status === "locked") lockedNote.current?.focus();
  }, [status]);

  // The rules text follows what is typed; a value that is not valid yet shows as off.
  const live = { minSwimDistanceM: whole(distance), extraSlowestPaceSecPer100m: parsePace(pace) };

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
          body: JSON.stringify({
            group: "extraRules",
            values: { minSwimDistanceM: distance, extraSlowestPace: pace },
          }),
        },
      );
      if (res.ok) {
        setStatus("saved");
      } else if (res.status === 409) {
        setStatus("locked");
      } else if (res.status === 400) {
        const fields = (await res.json().catch(() => null))?.error?.fields;
        const known: Record<string, string> = {};
        if (fields && typeof fields === "object") {
          for (const [k, v] of Object.entries(fields))
            if (k === "minSwimDistanceM" || k === "extraSlowestPace")
              known[k] = typeof v === "string" && t.has(`errors.${v}`) ? v : "UNKNOWN";
          // A formatted pace (m:ss), shown as text and never translated.
          const realistic = (fields as Record<string, unknown>).realisticSlowestPace;
          setRealisticPace(typeof realistic === "string" ? realistic : "");
        }
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
    <form onSubmit={onSubmit} noValidate aria-labelledby="extra-rules-settings-title">
      <h2 id="extra-rules-settings-title" className={styles.heading}>
        {t("title")}
      </h2>
      <p className={styles.intro}>{t("intro")}</p>
      {locked && (
        <p ref={lockedNote} role="status" tabIndex={-1} className={styles.lockedNote}>
          {t("locked")}
        </p>
      )}
      <fieldset className={styles.group}>
        <legend className={styles.legend}>{t("legend")}</legend>
        <Field
          id="minSwimDistanceM"
          name="minSwimDistanceM"
          inputMode="numeric"
          label={t("fields.minSwimDistanceM")}
          hint={t("hints.minSwimDistanceM")}
          value={distance}
          disabled={locked}
          onChange={(e) => setDistance(e.target.value)}
          error={errors.minSwimDistanceM ? t(`errors.${errors.minSwimDistanceM}`) : undefined}
        />
        <Field
          id="extraSlowestPace"
          name="extraSlowestPace"
          inputMode="numeric"
          placeholder="m:ss"
          label={t("fields.extraSlowestPace")}
          hint={t("hints.extraSlowestPace", { pace: formatPace(slowestPaceSecPer100m) })}
          value={pace}
          disabled={locked}
          onChange={(e) => setPace(e.target.value)}
          error={
            errors.extraSlowestPace
              ? t(`errors.${errors.extraSlowestPace}`, { pace: realisticPace })
              : undefined
          }
        />
      </fieldset>
      <h3 className={styles.subheading}>{t("rulesHeading")}</h3>
      <ExtraRules values={live} />
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
