"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import styles from "./settings-card.module.css";
import { RealisticLimitsRules } from "@/components/tournaments/rules/realistic-limits-rules";
import { Button, Field } from "@/components/ui";
import { formatKm, normalizeDecimal } from "@/lib/decimal-km";
import { clientFetch } from "@/lib/http/client-fetch";
import { formatPace, parsePace } from "@/lib/validation/settings/extra-rules";

type Status = "idle" | "saved" | "locked" | "failed" | "network";
type Stored = {
  fastestPaceSecPer100m: number;
  slowestPaceSecPer100m: number;
  longestRealisticSwimM: number;
};
type Bound = { min: number; max: number };
type Bounds = Record<keyof Stored, Bound>;

const INPUTS = ["fastestPace", "slowestPace", "longestRealisticSwimKm"] as const;
type Input = (typeof INPUTS)[number];
/** Keys of the allowed-range messages the server adds next to a refused bound. */
const KNOWN = new Set<string>(INPUTS);

/** Km as typed (at most 2 decimals) to whole metres, or null. */
function parseKm(text: string) {
  const s = String(normalizeDecimal(text.trim()));
  return /^\d+(\.\d{1,2})?$/.test(s) && Number(s) > 0 ? Math.round(Number(s) * 1000) : null;
}

/** Organizer form for the realistic swim limits; read-only once the season starts. */
export function RealisticLimitsForm({
  tournamentId,
  values,
  bounds,
  locked: initiallyLocked,
}: {
  tournamentId: string;
  values: Stored;
  /** The allowed range of each limit (the tournament's bounds snapshot). */
  bounds: Bounds;
  locked: boolean;
}) {
  const t = useTranslations("settings.realisticLimits");
  const locale = useLocale();
  const [text, setText] = useState<Record<Input, string>>({
    fastestPace: formatPace(values.fastestPaceSecPer100m),
    slowestPace: formatPace(values.slowestPaceSecPer100m),
    longestRealisticSwimKm: formatKm(values.longestRealisticSwimM, locale),
  });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [extra, setExtra] = useState<Record<string, string>>({});
  const locked = initiallyLocked || status === "locked";
  const lockedNote = useRef<HTMLParagraphElement>(null);

  // A 409 removes the focused Save button: move focus to the note so the lock is announced.
  useEffect(() => {
    if (status === "locked") lockedNote.current?.focus();
  }, [status]);

  const range = {
    fastestPace: `${formatPace(bounds.fastestPaceSecPer100m.min)}-${formatPace(bounds.fastestPaceSecPer100m.max)}`,
    slowestPace: `${formatPace(bounds.slowestPaceSecPer100m.min)}-${formatPace(bounds.slowestPaceSecPer100m.max)}`,
    longestRealisticSwimKm: `${formatKm(bounds.longestRealisticSwimM.min, locale)}-${formatKm(bounds.longestRealisticSwimM.max, locale)}`,
  };
  // The rules text follows what is typed; a value that is not valid yet shows as a dash.
  const live = {
    fastestPaceSecPer100m: parsePace(text.fastestPace),
    slowestPaceSecPer100m: parsePace(text.slowestPace),
    longestRealisticSwimM: parseKm(text.longestRealisticSwimKm),
  };

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
          body: JSON.stringify({ group: "realisticLimits", values: text }),
        },
      );
      if (res.ok) {
        setStatus("saved");
      } else if (res.status === 409) {
        setStatus("locked");
      } else if (res.status === 400) {
        const fields = (await res.json().catch(() => null))?.error?.fields;
        const known: Record<string, string> = {};
        const details: Record<string, string> = {};
        if (fields && typeof fields === "object") {
          for (const [k, v] of Object.entries(fields as Record<string, unknown>)) {
            if (KNOWN.has(k))
              known[k] = typeof v === "string" && t.has(`errors.${v}`) ? v : "UNKNOWN";
            // Formatted values (a range, a pace, km) are shown as text and never translated.
            else if (typeof v === "string") details[k] = v;
          }
        }
        setErrors(known);
        setExtra(details);
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

  const errorFor = (input: Input) => {
    const code = errors[input];
    if (!code) return undefined;
    return t(`errors.${code}`, {
      range: extra[`${input}Range`] ?? range[input],
      extraPace: extra.extraSlowestPace ?? "",
      minKm: extra.minSwimDistance ?? "",
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="realistic-limits-settings-title">
      <h2 id="realistic-limits-settings-title" className={styles.heading}>
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
        {INPUTS.map((input) => (
          <Field
            key={input}
            id={input}
            name={input}
            inputMode={input === "longestRealisticSwimKm" ? "decimal" : "numeric"}
            placeholder={input === "longestRealisticSwimKm" ? undefined : "m:ss"}
            label={t(`fields.${input}`)}
            hint={t("hints.range", { range: range[input] })}
            value={text[input]}
            disabled={locked}
            onChange={(e) => setText({ ...text, [input]: e.target.value })}
            error={errorFor(input)}
          />
        ))}
      </fieldset>
      <h3 className={styles.subheading}>{t("rulesHeading")}</h3>
      <RealisticLimitsRules values={live} />
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
