"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, SectionHeader } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import styles from "@/components/tournaments/manage.module.css";

/** Completed-only control of the organizer page: Archive with an in-page, single-flight confirm. */
export function ArchiveButton({ tournamentId }: { tournamentId: string }) {
  const t = useTranslations("lifecycle.archive");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"network" | "notCompleted" | "failed" | null>(null);
  const inFlight = useRef(false); // blocks a second click before React re-renders

  async function archive() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await clientFetch(`/api/tournaments/${tournamentId}/archive`, {
        method: "POST",
      }).catch(() => null);
      if (!res) setError("network");
      else if (res.ok) {
        setConfirming(false);
        router.refresh();
      } else {
        setError(res.status === 409 ? "notCompleted" : "failed");
        setConfirming(false);
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="archive-title" className={styles.panel}>
      <SectionHeader id="archive-title">{t("title")}</SectionHeader>
      <div className={styles.panelBody}>
        <p className={styles.hint}>{t("hint")}</p>
        {confirming ? (
          <div role="alertdialog" aria-label={t("button")} className={styles.confirm}>
            <span>{t("confirm")}</span>
            <span className={styles.actions}>
              <Button onClick={archive} disabled={busy}>
                {busy ? t("archiving") : t("confirmYes")}
              </Button>
              <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
                {t("cancel")}
              </Button>
            </span>
          </div>
        ) : (
          <Button onClick={() => setConfirming(true)}>{t("button")}</Button>
        )}
        {error && (
          <p role="alert" className={styles.error}>
            {t(`errors.${error}`)}
          </p>
        )}
      </div>
    </section>
  );
}
