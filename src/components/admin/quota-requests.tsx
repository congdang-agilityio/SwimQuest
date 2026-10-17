"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { Button, SectionHeader, TextareaField } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import styles from "./admin.module.css";

export type AdminQuotaRequest = {
  id: string;
  reason: string;
  createdAt: string;
  user: { id: string; displayName: string };
};

const REASON_MAX = 500;
const KNOWN_ERRORS = ["INVALID_REASON", "REQUEST_DECIDED", "FORBIDDEN", "NOT_FOUND"];

/**
 * Pending "one more tournament" requests (S-61), newest first: player, reason and date. Approve
 * grants one more tournament; reject needs a reason the player will see. A decided request leaves
 * the list.
 */
export function QuotaRequests() {
  const t = useTranslations("admin.tournamentRequests");
  const format = useFormatter();
  const [items, setItems] = useState<AdminQuotaRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    const res = await clientFetch("/api/admin/tournament-requests?status=PENDING").catch(
      () => null,
    );
    const body: { requests: AdminQuotaRequest[] } | null = res?.ok
      ? await res.json().catch(() => null)
      : null;
    if (!body) setFailed(true);
    else setItems(body.requests);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const trimmed = reason.trim();

  async function decide(id: string, approve: boolean) {
    if (inFlight.current) return;
    if (!approve && (trimmed.length < 1 || reason.length > REASON_MAX)) return;
    inFlight.current = true;
    setBusy(id);
    setError(null);
    try {
      const res = await clientFetch(`/api/admin/tournament-requests/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(approve ? { approve } : { approve, reason: trimmed }),
      }).catch(() => null);
      if (!res) setError("network");
      else if (res.ok) {
        setRejecting(null);
        setReason("");
        setItems((prev) => prev.filter((r) => r.id !== id));
      } else {
        const body = await res.json().catch(() => null);
        const code = String(body?.error?.code ?? "");
        setError(KNOWN_ERRORS.includes(code) ? code : "failed");
        if (code === "REQUEST_DECIDED" || code === "NOT_FOUND") {
          setRejecting(null);
          await load();
        }
      }
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="quota-requests-title" className={styles.panel}>
      <SectionHeader id="quota-requests-title">{t("listTitle")}</SectionHeader>
      <div className={styles.panelBody}>
        {failed && (
          <div className={styles.confirm}>
            <p role="alert" className={styles.error}>
              {t("loadError")}
            </p>
            <Button variant="secondary" onClick={() => void load()}>
              {t("retry")}
            </Button>
          </div>
        )}
        {!loading && !failed && items.length === 0 && <p className={styles.muted}>{t("empty")}</p>}
        <ul className={styles.list}>
          {items.map((r) => {
            const isRejecting = rejecting === r.id;
            return (
              <li key={r.id} className={styles.reportCard}>
                <span className={styles.name}>
                  <Link href={`/players/${r.user.id}`} className={styles.link}>
                    {r.user.displayName}
                  </Link>
                </span>
                <p className={styles.reportText}>{r.reason}</p>
                <dl className={styles.facts}>
                  <div className={styles.fact}>
                    <dt>{t("sentAt")}</dt>
                    <dd>
                      {format.dateTime(new Date(r.createdAt), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </dd>
                  </div>
                </dl>
                {!isRejecting && (
                  <span className={styles.actions}>
                    <Button onClick={() => void decide(r.id, true)} disabled={busy !== null}>
                      {busy === r.id ? t("saving") : t("approve")}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy !== null}
                      onClick={() => {
                        setRejecting(r.id);
                        setReason("");
                        setError(null);
                      }}
                    >
                      {t("reject")}
                    </Button>
                  </span>
                )}
                {isRejecting && (
                  <div role="alertdialog" aria-label={t("reject")} className={styles.confirm}>
                    <TextareaField
                      id={`quota-reject-${r.id}`}
                      label={t("reasonLabel")}
                      hint={t("reasonHint", { max: REASON_MAX })}
                      error={
                        error === "INVALID_REASON" || reason.length > REASON_MAX
                          ? t("errors.INVALID_REASON")
                          : undefined
                      }
                      value={reason}
                      rows={3}
                      maxLength={REASON_MAX + 100}
                      onChange={(e) => {
                        setReason(e.target.value);
                        if (error === "INVALID_REASON") setError(null);
                      }}
                    />
                    <span className={styles.actions}>
                      <Button
                        onClick={() => void decide(r.id, false)}
                        disabled={busy !== null || trimmed.length < 1 || reason.length > REASON_MAX}
                      >
                        {busy === r.id ? t("saving") : t("confirmReject")}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setRejecting(null)}
                        disabled={busy !== null}
                      >
                        {t("cancel")}
                      </Button>
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {error && error !== "INVALID_REASON" && (
          <p role="alert" className={styles.error}>
            {t(`errors.${error}`)}
          </p>
        )}
        {loading && <p className={styles.muted}>{t("loading")}</p>}
      </div>
    </section>
  );
}
