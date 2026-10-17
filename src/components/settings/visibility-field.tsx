"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import styles from "./settings-card.module.css";

type Visibility = "PUBLIC" | "INVITE_ONLY";
type Status = "idle" | "saved" | "failed" | "network";
const OPTIONS: readonly Visibility[] = ["PUBLIC", "INVITE_ONLY"];

/** Organizer choice of who can find and join the tournament; unselected until chosen (publishing needs it). */
export function VisibilityField({
  tournamentId,
  value,
}: {
  tournamentId: string;
  value: Visibility | null;
}) {
  const t = useTranslations("settings.visibility");
  const [chosen, setChosen] = useState<Visibility | null>(value);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>("idle");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !chosen) return;
    setBusy(true);
    setStatus("idle");
    try {
      const res = await clientFetch(
        `/api/tournaments/${encodeURIComponent(tournamentId)}/settings`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ group: "visibility", values: { visibility: chosen } }),
        },
      );
      setStatus(res.ok ? "saved" : "failed");
    } catch {
      setStatus("network");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="visibility-title">
      <h2 id="visibility-title" className={styles.heading}>
        {t("title")}
      </h2>
      <p className={styles.intro}>{chosen === null ? t("unset") : t("intro")}</p>
      <fieldset className={styles.choices}>
        <legend className={styles.legend}>{t("legend")}</legend>
        {OPTIONS.map((option) => (
          <label
            key={option}
            className={[styles.choice, chosen === option && styles.choiceOn]
              .filter(Boolean)
              .join(" ")}
          >
            <input
              type="radio"
              name="visibility"
              value={option}
              checked={chosen === option}
              onChange={() => {
                setChosen(option);
                setStatus("idle");
              }}
            />
            <span className={styles.choiceText}>
              <strong>{t(`options.${option}.label`)}</strong>
              <span>{t(`options.${option}.help`)}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className={styles.actions}>
        <Button type="submit" variant="primary" block disabled={busy || chosen === null}>
          {busy ? t("saving") : t("save")}
        </Button>
      </div>
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
