"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import styles from "./move-member-dialog.module.css";
import { Button } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";

type Props = {
  teamId: string;
  userId: string;
  name: string;
  /** True once the tournament has started: the confirm then explains that swims stay. */
  afterStart: boolean;
  className?: string;
};

/** Captain's or organizer's Remove on a roster row: in-page confirm, DELETE, refresh. */
export function RemoveMemberButton({ teamId, userId, name, afterStart, className }: Props) {
  const t = useTranslations("roster.remove");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"forbidden" | "notMember" | "failed" | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await clientFetch(
      `/api/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}`,
      { method: "DELETE" },
    ).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setConfirming(false);
      router.refresh();
      return;
    }
    setError(res?.status === 403 ? "forbidden" : res?.status === 422 ? "notMember" : "failed");
    if (res?.status === 403 || res?.status === 422) router.refresh();
  }

  const alert = error && (
    <p role="alert" className={styles.note}>
      {t(`error.${error}`)}
    </p>
  );

  if (!confirming) {
    return (
      <div className={className}>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          aria-label={t("for", { name })}
          onClick={() => setConfirming(true)}
          style={{ minHeight: 44, minWidth: 44 }}
        >
          {t("action")}
        </Button>
        {alert}
      </div>
    );
  }

  return (
    <div className={className}>
      <div role="alertdialog" aria-label={t("title", { name })} className={styles.confirm}>
        <p className={styles.confirmTitle}>{t("title", { name })}</p>
        <p className={styles.confirmBody}>
          {t(afterStart ? "bodyAfterStart" : "bodyBeforeStart", { name })}
        </p>
        {alert}
        <div className={styles.actions}>
          <Button type="button" disabled={busy} onClick={() => void remove()}>
            {t("confirm")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => setConfirming(false)}
          >
            {t("cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}
