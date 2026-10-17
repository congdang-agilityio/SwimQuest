"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, TextareaField } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import styles from "./swims.module.css";

const MAX_REASON = 300;
type Problem = "network" | "failed" | "DISPUTE_OPEN" | "NOT_DISPUTABLE";

/** "Dispute" button that opens a reason box (1-300 characters) for one tournament result. */
export function DisputeForm({ resultId }: { resultId: string }) {
  const t = useTranslations("my-swims.detail.dispute");
  const router = useRouter();
  const inFlight = useRef(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const id = `dispute-reason-${resultId}`;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current || reason.trim().length === 0) return;
    inFlight.current = true;
    setBusy(true);
    setProblem(null);
    try {
      const res = await clientFetch(`/api/results/${resultId}/dispute`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      }).catch(() => null);
      if (!res) return setProblem("network");
      if (res.ok) return router.refresh();
      const code = (await res.json().catch(() => null))?.error?.code;
      if (code === "DISPUTE_OPEN" || code === "NOT_DISPUTABLE") {
        setProblem(code);
        router.refresh();
      } else setProblem("failed");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {t("open")}
      </Button>
    );
  }
  return (
    <form className={styles.disputeForm} onSubmit={send}>
      <TextareaField
        id={id}
        label={t("reasonLabel")}
        hint={t("count", { count: reason.length, max: MAX_REASON })}
        error={problem ? t(`errors.${problem}`) : undefined}
        value={reason}
        maxLength={MAX_REASON}
        rows={3}
        required
        onChange={(e) => setReason(e.target.value)}
      />
      <span className={styles.disputeActions}>
        <Button type="submit" size="sm" disabled={busy || reason.trim().length === 0}>
          {busy ? t("sending") : t("send")}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>
          {t("cancel")}
        </Button>
      </span>
    </form>
  );
}
