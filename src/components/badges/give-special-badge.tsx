"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BadgeImage } from "@/components/badges/badge-image";
import { Button, Card, TextareaField } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import styles from "./give-special-badge.module.css";

const REASON_MAX = 200;
const KNOWN_ERRORS = ["REASON_LENGTH", "NOT_A_PLAYER", "ALREADY_AWARDED", "ARCHIVED"];

/**
 * Organizer member page (S-50): "Give Special badge" asks for a short reason and confirms in the
 * page. Once given (now or earlier) the button is gone and the reason is shown instead.
 */
export function GiveSpecialBadge({
  tournamentId,
  userId,
  givenReason,
}: {
  tournamentId: string;
  userId: string;
  /** The reason of the Special badge the player already has; null when they do not have it. */
  givenReason: string | null;
}) {
  const t = useTranslations("badges.special");
  const [given, setGiven] = useState<string | null>(givenReason);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    const text = reason.trim();
    if (text.length < 1 || text.length > REASON_MAX) {
      setError("REASON_LENGTH");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await clientFetch(
        `/api/tournaments/${encodeURIComponent(tournamentId)}/players/${encodeURIComponent(userId)}/special-badge`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason: text }),
        },
      );
      if (res.ok) {
        setGiven(text);
        setOpen(false);
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        error?: { code?: string; fields?: { reason?: string } };
      } | null;
      const code = body?.error?.fields?.reason ?? body?.error?.code ?? "";
      if (code === "ALREADY_AWARDED") setGiven(text);
      setError(KNOWN_ERRORS.includes(code) ? code : "GENERIC");
    } catch {
      setError("GENERIC");
    } finally {
      setBusy(false);
    }
  }

  if (given !== null) {
    return (
      <Card as="section" aria-label={t("title")} className={styles.panel}>
        <div className={styles.given}>
          <BadgeImage kind="SPECIAL" size={72} />
          <div>
            <h2 className={styles.heading}>{t("given")}</h2>
            <p className={styles.reason}>{t("givenReason", { reason: given })}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card as="section" aria-label={t("title")} className={styles.panel}>
      <div className={styles.given}>
        <BadgeImage kind="SPECIAL" size={72} />
        {!open && <Button onClick={() => setOpen(true)}>{t("give")}</Button>}
      </div>
      {open && (
        <div className={styles.panel} role="group" aria-labelledby="special-confirm-title">
          <h2 id="special-confirm-title" className={styles.heading}>
            {t("confirmTitle")}
          </h2>
          <p className={styles.confirmText}>{t("confirmText")}</p>
          <TextareaField
            id="special-reason"
            label={t("reasonLabel")}
            hint={t("reasonHint")}
            value={reason}
            maxLength={REASON_MAX}
            rows={3}
            onChange={(event) => setReason(event.target.value)}
          />
          {error && (
            <p className={styles.problem} role="alert">
              {t(`errors.${error}`)}
            </p>
          )}
          <div className={styles.actions}>
            <Button onClick={confirm} disabled={busy}>
              {t("confirm")}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
