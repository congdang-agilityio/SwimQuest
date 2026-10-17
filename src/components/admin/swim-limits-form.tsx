"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button, Field, SectionHeader, TextareaField } from "@/components/ui";
import { formatKm, normalizeDecimal } from "@/lib/decimal-km";
import { clientFetch } from "@/lib/http/client-fetch";
import type { SwimLimitConfig, SwimLimitField } from "@/lib/swim-limits";
import { formatPace, parsePace } from "@/lib/validation/settings/extra-rules";
import styles from "./admin.module.css";

const LIMITS = [
  { field: "fastestPaceSecPer100m", kind: "pace" },
  { field: "slowestPaceSecPer100m", kind: "pace" },
  { field: "longestRealisticSwimM", kind: "km" },
] as const satisfies readonly { field: SwimLimitField; kind: "pace" | "km" }[];
type Part = "value" | "min" | "max";
const PARTS: Part[] = ["value", "min", "max"];
const KNOWN_CODES = new Set([
  "INVALID_NUMBER",
  "MIN_ABOVE_MAX",
  "OUT_OF_BOUNDS",
  "NOT_FASTER_THAN_SLOWEST",
  "REQUIRED",
]);
type Status = "idle" | "saved" | "failed" | "network";

/** Km as typed (a decimal comma is fine, up to 3 decimals) to whole metres, or null. */
function parseKm(text: string) {
  const s = String(normalizeDecimal(text.trim()));
  return /^\d+(\.\d{1,3})?$/.test(s) && Number(s) > 0 ? Math.round(Number(s) * 1000) : null;
}

/** Platform admin form for the default swim limits and their sanity bounds (S-64). */
export function SwimLimitsForm({ initial }: { initial: SwimLimitConfig }) {
  const t = useTranslations("admin.swimLimits");
  const locale = useLocale();
  const show = (kind: "pace" | "km", n: number) =>
    kind === "pace" ? formatPace(n) : formatKm(n, locale);
  const [text, setText] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = { reason: "" };
    for (const { field, kind } of LIMITS) {
      out[`${field}.value`] = show(kind, initial.defaults[field]);
      out[`${field}.min`] = show(kind, initial.bounds[field].min);
      out[`${field}.max`] = show(kind, initial.bounds[field].max);
    }
    return out;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [busy, setBusy] = useState(false);

  const parse = (kind: "pace" | "km", key: string) =>
    kind === "pace" ? parsePace(text[key]) : parseKm(text[key]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const defaults: Record<string, number | null> = {};
    const bounds: Record<string, { min: number | null; max: number | null }> = {};
    for (const { field, kind } of LIMITS) {
      defaults[field] = parse(kind, `${field}.value`);
      bounds[field] = { min: parse(kind, `${field}.min`), max: parse(kind, `${field}.max`) };
    }
    setBusy(true);
    setStatus("idle");
    setErrors({});
    try {
      const res = await clientFetch("/api/admin/swim-limits", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ defaults, bounds, reason: text.reason }),
      });
      if (res.ok) {
        setStatus("saved");
      } else if (res.status === 400) {
        const fields = (await res.json().catch(() => null))?.error?.fields;
        const next: Record<string, string> = {};
        for (const [path, code] of Object.entries(fields ?? {})) {
          // "bounds.f.min" -> "f.min", "defaults.f" -> "f.value", "bounds.f" -> "f.min".
          const [group, field, part] = path.split(".");
          const key =
            group === "reason"
              ? "reason"
              : group === "defaults"
                ? `${field}.value`
                : `${field}.${part ?? "min"}`;
          next[key] = typeof code === "string" && KNOWN_CODES.has(code) ? code : "UNKNOWN";
        }
        setErrors(next);
        if (Object.keys(next).length === 0) setStatus("failed");
      } else {
        setStatus("failed");
      }
    } catch {
      setStatus("network");
    } finally {
      setBusy(false);
    }
  }

  const errorFor = (key: string) => (errors[key] ? t(`errors.${errors[key]}`) : undefined);

  return (
    <form onSubmit={onSubmit} noValidate className={styles.panelBody}>
      <p className={styles.muted}>{t("intro")}</p>
      <p role="note" className={styles.confirm}>
        {t("existingNote")}
      </p>
      {LIMITS.map(({ field, kind }) => (
        <section key={field} aria-labelledby={`${field}-title`} className={styles.panel}>
          <SectionHeader id={`${field}-title`}>{t(`fields.${field}`)}</SectionHeader>
          <div className={styles.panelBody}>
            {PARTS.map((part) => {
              const key = `${field}.${part}`;
              return (
                <Field
                  key={key}
                  id={`${field}-${part}`}
                  name={key}
                  inputMode={kind === "km" ? "decimal" : "numeric"}
                  placeholder={kind === "pace" ? "m:ss" : undefined}
                  label={t(`parts.${part}.${kind}`)}
                  value={text[key]}
                  onChange={(e) => setText({ ...text, [key]: e.target.value })}
                  error={errorFor(key)}
                />
              );
            })}
          </div>
        </section>
      ))}
      <TextareaField
        id="swim-limits-reason"
        name="reason"
        label={t("reason")}
        hint={t("reasonHint")}
        rows={3}
        maxLength={500}
        value={text.reason}
        onChange={(e) => setText({ ...text, reason: e.target.value })}
        error={errorFor("reason")}
      />
      <Button type="submit" variant="primary" block disabled={busy}>
        {busy ? t("saving") : t("save")}
      </Button>
      {status === "saved" && (
        <p role="status" className={styles.ok}>
          {t("saved")}
        </p>
      )}
      {(status === "failed" || status === "network") && (
        <p role="alert" className={styles.error}>
          {status === "network" ? t("networkError") : t("failed")}
        </p>
      )}
    </form>
  );
}
