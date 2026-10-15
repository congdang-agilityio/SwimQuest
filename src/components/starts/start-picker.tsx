"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { formatVnDateTime } from "@/lib/time/vn";

const control = { minHeight: 44, minWidth: 44, boxSizing: "border-box", padding: 8 } as const;
const row = { display: "flex", alignItems: "center", gap: 8, minHeight: 44 } as const;
const errorColor = { color: "#b91c1c" };

type Props = {
  teamId: string;
  /** Start destinations (never the finish), in route order. */
  starts: readonly string[];
  finish: string;
  currentSlug: string | null;
  routeDistanceKm: number;
  /** ISO instant of the start lock. */
  lockAtIso: string;
  /** Members, and everyone after the lock, see the start without choosing. */
  readOnly: boolean;
};

export function StartPicker({
  teamId,
  starts,
  finish,
  currentSlug,
  routeDistanceKm,
  lockAtIso,
  readOnly,
}: Props) {
  const t = useTranslations("starts");
  const [selected, setSelected] = useState<string | null>(currentSlug);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(null);
    if (!selected) return setError(t("picker.errors.NO_SELECTION"));
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/teams/${encodeURIComponent(teamId)}/start`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ destination: selected }),
      });
      if (res.ok) {
        setSaved(
          t("picker.saved", {
            name: t(`names.${selected}`),
            lockAt: formatVnDateTime(new Date(lockAtIso)),
          }),
        );
      } else {
        const body = (await res.json().catch(() => null)) as {
          error?: { code?: string; issues?: { lockedAt?: string }[] };
        } | null;
        const code = body?.error?.code;
        const lockedAt = body?.error?.issues?.[0]?.lockedAt;
        if (code === "START_LOCKED" && lockedAt)
          setError(
            t("picker.errors.START_LOCKED", { lockedAt: formatVnDateTime(new Date(lockedAt)) }),
          );
        else if (code === "INVALID_START" || code === "FORBIDDEN")
          setError(t(`picker.errors.${code}`));
        else setError(t("picker.errors.GENERIC"));
      }
    } catch {
      setError(t("picker.errors.GENERIC"));
    }
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="start-picker-title">
      <h1 id="start-picker-title">{t("picker.title")}</h1>
      {readOnly && <p>{t("picker.readOnly")}</p>}
      <fieldset
        aria-invalid={error && !saved ? true : undefined}
        aria-describedby={error ? "start-error" : undefined}
      >
        <legend>{t("picker.legend")}</legend>
        {starts.map((slug) => (
          <label key={slug} style={row}>
            <input
              type="radio"
              name="destination"
              value={slug}
              checked={selected === slug}
              disabled={readOnly}
              onChange={() => setSelected(slug)}
              style={control}
            />
            <span>
              {t(`names.${slug}`)} ({t("picker.distance", { km: routeDistanceKm })})
            </span>
          </label>
        ))}
        <label style={row}>
          <input type="radio" name="destination" value={finish} disabled style={control} />
          <span>
            {t(`names.${finish}`)} ({t("picker.finish")})
          </span>
        </label>
      </fieldset>
      {error && (
        <p id="start-error" role="alert" style={errorColor}>
          {error}
        </p>
      )}
      {saved && <p role="status">{saved}</p>}
      {!readOnly && (
        <button type="submit" disabled={busy} style={control}>
          {t("picker.confirm")}
        </button>
      )}
      <p>
        <a
          href="/team"
          style={{ display: "inline-flex", alignItems: "center", minHeight: 44, minWidth: 44 }}
        >
          {t("picker.back")}
        </a>
      </p>
    </form>
  );
}
