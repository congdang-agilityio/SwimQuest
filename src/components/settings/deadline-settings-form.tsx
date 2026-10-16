"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { clientFetch } from "@/lib/http/client-fetch";
import { formatVnDateTime, utcToVnParts } from "@/lib/time/vn";

const control = { minHeight: 44, width: "100%", boxSizing: "border-box", padding: 8 } as const;
const errorColor = { color: "#b91c1c" };
const FIELDS = ["submissionDays", "lateUploadDays", "startChoiceDeadlineDate"];

type Status = "idle" | "saved" | "locked" | "failed" | "network";

export type DeadlineSettingsValues = {
  submissionDays: number;
  lateUploadDays: number;
  /** ISO instant, or null = at the season start. */
  startChoiceDeadlineAt: string | null;
  seasonStartAt: string;
};

/** Organizer form for the deadline settings group; read-only with a note once the season is locked. */
export function DeadlineSettingsForm({
  tournamentId,
  values,
  locked: initiallyLocked,
}: {
  tournamentId: string;
  values: DeadlineSettingsValues;
  locked: boolean;
}) {
  const t = useTranslations("settings.deadlines");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const locked = initiallyLocked || status === "locked";
  const lockedNote = useRef<HTMLParagraphElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const parts = values.startChoiceDeadlineAt
    ? utcToVnParts(new Date(values.startChoiceDeadlineAt))
    : { date: "", time: "" };

  // A 409 removes the focused Save button: move focus to the note so the lock is announced.
  useEffect(() => {
    if (status === "locked") lockedNote.current?.focus();
  }, [status]);

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
            group: "deadlines",
            values: {
              submissionDays: form.get("submissionDays"),
              lateUploadDays: form.get("lateUploadDays"),
              startChoiceDeadlineDate: form.get("startChoiceDeadlineDate"),
              startChoiceDeadlineTime: form.get("startChoiceDeadlineTime"),
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
            if (FIELDS.includes(k))
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

  const describedBy = (name: string) =>
    errors[name] ? `${name}-help ${name}-error` : `${name}-help`;
  const fieldError = (name: string) =>
    errors[name] && (
      <span id={`${name}-error`} role="alert" style={errorColor}>
        {" "}
        {t(`errors.${errors[name]}`)}
      </span>
    );

  const days = (name: string, label: string, help: string, defaultValue: number) => (
    <p>
      <label>
        {label}
        <input
          name={name}
          inputMode="numeric"
          defaultValue={String(defaultValue)}
          disabled={locked}
          aria-invalid={errors[name] ? true : undefined}
          aria-describedby={describedBy(name)}
          style={control}
        />
      </label>
      <small id={`${name}-help`}>{help}</small>
      {fieldError(name)}
    </p>
  );

  function clearDeadline() {
    const form = formRef.current;
    if (!form) return;
    (form.elements.namedItem("startChoiceDeadlineDate") as HTMLInputElement).value = "";
    (form.elements.namedItem("startChoiceDeadlineTime") as HTMLInputElement).value = "";
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate aria-labelledby="deadline-settings-title">
      <h2 id="deadline-settings-title">{t("title")}</h2>
      {locked && (
        <p ref={lockedNote} role="status" tabIndex={-1}>
          {t("locked")}
        </p>
      )}
      {days("submissionDays", t("submissionDays"), t("submissionDaysHelp"), values.submissionDays)}
      {days("lateUploadDays", t("lateUploadDays"), t("lateUploadDaysHelp"), values.lateUploadDays)}
      <p>
        <label>
          {t("deadlineDate")}
          <input
            name="startChoiceDeadlineDate"
            type="date"
            defaultValue={parts.date}
            disabled={locked}
            aria-invalid={errors.startChoiceDeadlineDate ? true : undefined}
            aria-describedby={describedBy("startChoiceDeadlineDate")}
            style={control}
          />
        </label>
        <label>
          {t("deadlineTime")}
          <input
            name="startChoiceDeadlineTime"
            type="time"
            defaultValue={parts.time}
            disabled={locked}
            style={control}
          />
        </label>
        <small id="startChoiceDeadlineDate-help">
          {t("deadlineHelp", { seasonStart: formatVnDateTime(new Date(values.seasonStartAt)) })}
        </small>
        {fieldError("startChoiceDeadlineDate")}
      </p>
      {!locked && (
        <p>
          <button
            type="button"
            onClick={clearDeadline}
            style={{ minHeight: 44, minWidth: 44, padding: 8 }}
          >
            {t("atSeasonStart")}
          </button>
        </p>
      )}
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
