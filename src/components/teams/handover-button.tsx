"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import joinStyles from "@/components/join/join.module.css";
import { Button } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import styles from "./my-team.module.css";

type Props = { teamId: string; userId: string; name: string };

/** The captain's per-member "Make captain" action, behind an in-page confirm step. */
export function HandoverButton({ teamId, userId, name }: Props) {
  const t = useTranslations("team.handover");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<"forbidden" | "notMember" | "failed" | null>(null);

  async function handOver() {
    setBusy(true);
    setFailed(null);
    const res = await clientFetch(`/api/teams/${encodeURIComponent(teamId)}/handover`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setConfirming(false);
      router.refresh();
      return;
    }
    setFailed(res?.status === 403 ? "forbidden" : res?.status === 422 ? "notMember" : "failed");
    if (res?.status === 403 || res?.status === 422) router.refresh();
  }

  if (!confirming) {
    return (
      <div className={styles.handover}>
        <Button
          size="sm"
          variant="secondary"
          aria-label={t("makeFor", { name })}
          onClick={() => setConfirming(true)}
        >
          {t("make")}
        </Button>
        {failed && (
          <p role="alert" className={joinStyles.alert}>
            {t(`error.${failed}`)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div role="group" aria-label={t("make")} className={`${styles.confirm} ${styles.handover}`}>
      <strong>{t("title", { name })}</strong>
      <p className={styles.note}>{t("body", { name })}</p>
      {failed && (
        <p role="alert" className={joinStyles.alert}>
          {t(`error.${failed}`)}
        </p>
      )}
      <div className={styles.moveButtons}>
        <Button disabled={busy} onClick={handOver}>
          {t("confirm")}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
