"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button, Card, Chip, ProgressBar, TextareaField } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import styles from "./quota-request.module.css";

export type QuotaRequestView = {
  status: "PENDING" | "APPROVED" | "REJECTED";
  reason: string;
  decisionReason: string | null;
} | null;

type Props = { used: number; allowed: number; request: QuotaRequestView };

const REASON_MAX = 500;

/**
 * The player's tournament quota (S-61): "x of y used"; at the limit a reason form to ask an admin
 * for one more, the pending request, or the rejection with its reason. Approval shows until the
 * extra tournament is used.
 */
export function QuotaRequest({ used, allowed, request }: Props) {
  const t = useTranslations("quota");
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const atLimit = used >= allowed;
  const pending = request?.status === "PENDING";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return setError(t("errors.INVALID_REASON"));
    setBusy(true);
    setError(null);
    try {
      const res = await clientFetch("/api/tournament-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (res.ok) {
        setReason("");
        return router.refresh();
      }
      const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
      const code = body?.error?.code;
      if (code === "REQUEST_PENDING" || code === "QUOTA_NOT_REACHED") return router.refresh();
      setError(t(code === "INVALID_REASON" ? "errors.INVALID_REASON" : "errors.generic"));
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card as="section" id="quota" className={styles.card} aria-labelledby="quota-title">
      <h2 id="quota-title" className={styles.title}>
        {t("title")}
      </h2>
      <ProgressBar
        tone="light"
        value={allowed > 0 ? (used / allowed) * 100 : 100}
        label={t("used", { used, allowed })}
        caption={t("used", { used, allowed })}
      />
      {request?.status === "APPROVED" && !atLimit && (
        <p className={styles.status}>
          <Chip tone="success">{t("approved")}</Chip>
          <span>{t("approvedText")}</span>
        </p>
      )}
      {atLimit && pending && (
        <p className={styles.status} role="status">
          <Chip tone="warning">{t("pending")}</Chip>
          <span>{t("pendingText")}</span>
          <q className={styles.quote}>{request.reason}</q>
        </p>
      )}
      {atLimit && !pending && (
        <>
          {request?.status === "REJECTED" && (
            <p className={styles.status}>
              <Chip tone="danger">{t("rejected")}</Chip>
              {request.decisionReason && (
                <span>{t("rejectedReason", { reason: request.decisionReason })}</span>
              )}
            </p>
          )}
          <form className={styles.form} onSubmit={submit} noValidate>
            <p className={styles.text}>{t("limitText")}</p>
            <TextareaField
              id="quota-reason"
              label={t("reasonLabel")}
              hint={t("reasonHint", { max: REASON_MAX })}
              rows={3}
              maxLength={REASON_MAX}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              error={error ?? undefined}
            />
            <Button type="submit" block disabled={busy} aria-busy={busy}>
              {t("send")}
            </Button>
          </form>
        </>
      )}
    </Card>
  );
}
