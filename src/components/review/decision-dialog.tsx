"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, TextareaField } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import styles from "./review.module.css";

type Done = "approved" | "rejected" | "already";
type Failure = "failed" | "network" | "reasonRequired";

/** Approve, or reject with a reason entered in an in-page confirm; then the queue refreshes. */
export function DecisionDialog({
  resultId,
  playerName,
  disputeId,
}: {
  resultId: string;
  playerName: string;
  /** Dispute mode: both decisions need a reason and post to the dispute decision route. */
  disputeId?: string;
}) {
  const t = useTranslations("review.decision");
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [accepting, setAccepting] = useState(false); // dispute mode: the reason form is for accept
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<Failure | null>(null);
  const inFlight = useRef(false); // blocks a second click before React re-renders
  const reasonId = `reject-reason-${disputeId ?? resultId}`;

  async function decide(approve: boolean) {
    if (inFlight.current) return;
    const trimmed = reason.trim();
    if ((!approve || disputeId) && trimmed === "") return setError("reasonRequired");
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const url = disputeId
        ? `/api/review/disputes/${disputeId}/decision`
        : `/api/review/results/${resultId}/decision`;
      const body = disputeId
        ? { accept: approve, reason: trimmed }
        : approve
          ? { approve }
          : { approve, reason: trimmed };
      const res = await clientFetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => null);
      if (!res) setError("network");
      else if (res.ok || res.status === 409) {
        setDone(res.ok ? (approve ? "approved" : "rejected") : "already");
        router.refresh(); // the decided swim leaves the queue
      } else if (res.status === 400 && (!approve || disputeId)) setError("reasonRequired");
      else setError("failed");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function submitReject(e: FormEvent) {
    e.preventDefault();
    void decide(accepting);
  }

  if (done) {
    return (
      <p role="status" className={styles.done}>
        {done === "already" ? t("errors.already") : t(done)}
      </p>
    );
  }

  const mode = disputeId ? (accepting ? "accept" : "reject") : "reject";
  const errorText = error && error !== "reasonRequired" ? t(`errors.${error}`) : null;

  return (
    <div className={styles.decision}>
      {rejecting ? (
        <form
          role="alertdialog"
          aria-label={t(mode === "accept" ? "acceptFor" : "rejectFor", { name: playerName })}
          className={styles.confirm}
          onSubmit={submitReject}
          noValidate
        >
          <TextareaField
            id={reasonId}
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
              {busy ? t("saving") : t(mode === "accept" ? "confirmAccept" : "confirmReject")}
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setRejecting(false);
                setAccepting(false);
                setError(null);
              }}
            >
              {t("cancel")}
            </Button>
          </span>
        </form>
      ) : (
        <div className={styles.actions}>
          <Button
            onClick={() => {
              if (!disputeId) return void decide(true);
              setAccepting(true);
              setRejecting(true);
            }}
            disabled={busy}
            aria-label={t(disputeId ? "acceptFor" : "approveFor", { name: playerName })}
          >
            {busy ? t("saving") : t(disputeId ? "accept" : "approve")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setAccepting(false);
              setRejecting(true);
            }}
            disabled={busy}
            aria-label={t("rejectFor", { name: playerName })}
          >
            {t("reject")}
          </Button>
        </div>
      )}
      {errorText && (
        <p role="alert" className={styles.error}>
          {errorText}
        </p>
      )}
    </div>
  );
}
