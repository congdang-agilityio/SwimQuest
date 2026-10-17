"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, SectionHeader, TextareaField } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import styles from "./admin.module.css";

type Props = { userId: string; displayName: string; status: string };

const MAX_REASON = 500;
const KNOWN_ERRORS = [
  "INVALID_REASON",
  "INVALID_STATE",
  "CANNOT_SUSPEND_SELF",
  "FORBIDDEN",
  "NOT_FOUND",
];

/** Suspends or reactivates an account after an in-page confirmation with a required reason. */
export function AccountStatusActions({ userId, displayName, status }: Props) {
  const t = useTranslations("admin.user.account");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const inFlight = useRef(false);

  if (status !== "ACTIVE" && status !== "SUSPENDED") return null;
  const suspending = status === "ACTIVE";
  const key = suspending ? "suspend" : "reactivate";
  const trimmed = reason.trim();
  const reasonError =
    error === "INVALID_REASON" || reason.length > MAX_REASON
      ? t("errors.INVALID_REASON")
      : undefined;

  async function change() {
    if (inFlight.current || trimmed.length < 1 || trimmed.length > MAX_REASON) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await clientFetch(`/api/admin/users/${userId}/status`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: suspending ? "SUSPENDED" : "ACTIVE", reason: trimmed }),
      }).catch(() => null);
      if (!res) setError("network");
      else if (res.ok) {
        setDone(key);
        setConfirming(false);
        setReason("");
        router.refresh();
      } else {
        const body = await res.json().catch(() => null);
        const code = String(body?.error?.code ?? body?.code ?? "");
        setError(KNOWN_ERRORS.includes(code) ? code : "failed");
        if (code !== "INVALID_REASON") setConfirming(false);
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="status-title" className={styles.panel}>
      <SectionHeader id="status-title">{t("title")}</SectionHeader>
      <div className={styles.panelBody}>
        <p className={styles.muted}>{t(`${key}Help`)}</p>
        {confirming ? (
          <div role="alertdialog" aria-label={t(key)} className={styles.confirm}>
            <span>{t(`${key}Confirm`, { name: displayName })}</span>
            <TextareaField
              id="status-reason"
              label={t("reasonLabel")}
              hint={t("reasonHint", { max: MAX_REASON })}
              error={reasonError}
              value={reason}
              rows={3}
              maxLength={MAX_REASON + 100}
              onChange={(e) => {
                setReason(e.target.value);
                if (error === "INVALID_REASON") setError(null);
              }}
            />
            <span className={styles.actions}>
              <Button
                variant="primary"
                onClick={change}
                disabled={busy || trimmed.length < 1 || reason.length > MAX_REASON}
              >
                {busy ? t("saving") : t("confirmYes")}
              </Button>
              <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
                {t("cancel")}
              </Button>
            </span>
          </div>
        ) : (
          <Button
            variant={suspending ? "secondary" : "primary"}
            onClick={() => {
              setDone(null);
              setError(null);
              setConfirming(true);
            }}
          >
            {t(key)}
          </Button>
        )}
        {error && error !== "INVALID_REASON" && (
          <p role="alert" className={styles.error}>
            {t(`errors.${error}`)}
          </p>
        )}
        {done && !confirming && (
          <p role="status" className={styles.ok}>
            {t(`${done}Done`)}
          </p>
        )}
      </div>
    </section>
  );
}
