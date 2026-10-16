"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { kmText, type SwimRulesValues } from "@/components/tournaments/rules/swim-rules";
import { clientFetch } from "@/lib/http/client-fetch";

const control = { minHeight: 44, width: "100%", boxSizing: "border-box", padding: 8 } as const;
const errorColor = { color: "#b91c1c" };
const TYPES = ["ANY", "POOL_ONLY", "OPEN_WATER_ONLY"] as const;

type Status = "idle" | "saved" | "locked" | "failed" | "network";

/** Organizer form for the swim settings group; read-only with a note once the season is locked. */
export function SwimSettingsForm({
  tournamentId,
  values,
  locked: initiallyLocked,
}: {
  tournamentId: string;
  values: SwimRulesValues;
  locked: boolean;
}) {
  const t = useTranslations("settings.swim");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const locked = initiallyLocked || status === "locked";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || locked) return;
    const form = new FormData(event.currentTarget);
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
            group: "swim",
            values: {
              longestSwimCountedKm: form.get("longestSwimCountedKm"),
              dailyLimitKm: form.get("dailyLimitKm"),
              swimTypeAllowed: form.get("swimTypeAllowed"),
            },
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
        if (fields && typeof fields === "object")
          for (const [k, v] of Object.entries(fields))
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

  const field = (name: string, label: string, help: string, defaultValue: string) => (
    <p>
      <label>
        {label}
        <input
          name={name}
          inputMode="decimal"
          defaultValue={defaultValue}
          disabled={locked}
          aria-invalid={errors[name] ? true : undefined}
          aria-describedby={`${name}-help`}
          style={control}
        />
      </label>
      <small id={`${name}-help`}>{help}</small>
      {errors[name] && (
        <span role="alert" style={errorColor}>
          {" "}
          {t(`errors.${errors[name]}`)}
        </span>
      )}
    </p>
  );

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="swim-settings-title">
      <h2 id="swim-settings-title">{t("title")}</h2>
      {locked && <p role="note">{t("locked")}</p>}
      {field(
        "longestSwimCountedKm",
        t("longestSwimCounted"),
        t("longestSwimCountedHelp"),
        kmText(values.longestSwimCountedM),
      )}
      {field("dailyLimitKm", t("dailyLimit"), t("dailyLimitHelp"), kmText(values.dailyLimitM))}
      <p>
        <label>
          {t("swimType")}
          <select
            name="swimTypeAllowed"
            defaultValue={values.swimTypeAllowed}
            disabled={locked}
            aria-describedby="swimTypeAllowed-help"
            style={control}
          >
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`types.${type}`)}
              </option>
            ))}
          </select>
        </label>
        <small id="swimTypeAllowed-help">{t("swimTypeHelp")}</small>
        {errors.swimTypeAllowed && (
          <span role="alert" style={errorColor}>
            {" "}
            {t(`errors.${errors.swimTypeAllowed}`)}
          </span>
        )}
      </p>
      {!locked && (
        <button type="submit" disabled={busy} style={{ minHeight: 44, minWidth: 44, padding: 8 }}>
          {busy ? t("saving") : t("save")}
        </button>
      )}
      {status === "saved" && <p role="status">{t("saved")}</p>}
      {(status === "failed" || status === "network") && (
        <p role="alert" style={errorColor}>
          {status === "network" ? t("networkError") : t("failed")}
        </p>
      )}
    </form>
  );
}
