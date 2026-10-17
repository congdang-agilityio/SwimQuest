"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, TextareaField } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import styles from "./review.module.css";

type Failure = "failed" | "network" | "forbidden" | "notRevokable" | "reasonRequired";

/**
 * Revoke a verified result with a reason, after an in-page confirm; then the page refreshes.
 * `endpoint` defaults to the reviewer route; the admin user page passes the admin route (S-72).
 */
export function RevokeDialog({
  resultId,
  playerName,
  endpoint = `/api/review/results/${resultId}/revoke`,
}: {
  resultId: string;
  playerName: string;
  endpoint?: string;
}) {
  const t = useTranslations("review.revoke");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<Failure | null>(null);
  const inFlight = useRef(false);

  async function revoke(e: FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    const trimmed = reason.trim();
    if (trimmed === "") return setError("reasonRequired");
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await clientFetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: trimmed }),
      }).catch(() => null);
      if (!res) setError("network");
      else if (res.ok) setDone(true);
      else if (res.status === 409) setError("notRevokable");
      else if (res.status === 400) setError("reasonRequired");
      else setError(res.status === 403 ? "forbidden" : "failed");
      if (res?.ok || res?.status === 409) router.refresh();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p role="status" className={styles.done}>
        {t("done")}
      </p>
    );
  }

  const errorText = error && error !== "reasonRequired" ? t(`errors.${error}`) : null;

  return (
    <div className={styles.decision}>
      {open ? (
        <form
          role="alertdialog"
          aria-label={t("confirmFor", { name: playerName })}
          className={styles.confirm}
          onSubmit={revoke}
          noValidate
        >
          <p className={styles.warning}>{t("warning")}</p>
          <TextareaField
            id={`revoke-reason-${resultId}`}
            label={t("reason")}
            hint={t("reasonHint")}
            error={error === "reasonRequired" ? t("reasonRequired") : undefined}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error === "reasonRequired") setError(null);
            }}
            maxLength={300}
            rows={3}
            required
          />
          <span className={styles.actions}>
            <Button type="submit" disabled={busy}>
              {busy ? t("saving") : t("confirm")}
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
            >
              {t("cancel")}
            </Button>
          </span>
        </form>
      ) : (
        <Button
          variant="secondary"
          onClick={() => setOpen(true)}
          aria-label={t("openFor", { name: playerName })}
        >
          {t("open")}
        </Button>
      )}
      {errorText && (
        <p role="alert" className={styles.error}>
          {errorText}
        </p>
      )}
    </div>
  );
}
