"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, SectionHeader } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import styles from "./admin.module.css";

type Props = { userId: string; displayName: string };

const KNOWN_ERRORS = ["FORBIDDEN", "NOT_FOUND"];

/**
 * Sets a temporary password after an in-page confirmation (S-59 AC 2) and shows it once, to pass
 * to the player outside the app. The password lives only in this component's state: it is never
 * stored in the browser or logged, and it is gone when the admin closes the panel.
 */
export function ResetPasswordButton({ userId, displayName }: Props) {
  const t = useTranslations("admin.user.password");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState<"yes" | "no" | null>(null);
  const inFlight = useRef(false);

  async function reset() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await clientFetch(`/api/admin/users/${userId}/password-reset`, {
        method: "POST",
        cache: "no-store",
      }).catch(() => null);
      if (!res) setError("network");
      else if (res.ok) {
        const body = (await res.json().catch(() => null)) as { temporaryPassword?: unknown } | null;
        if (typeof body?.temporaryPassword === "string") setPassword(body.temporaryPassword);
        else setError("failed");
      } else {
        const body = await res.json().catch(() => null);
        const code = String(body?.error?.code ?? body?.code ?? "");
        setError(KNOWN_ERRORS.includes(code) ? code : "failed");
      }
    } finally {
      setConfirming(false);
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function copy() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied("yes");
    } catch {
      setCopied("no");
    }
  }

  function close() {
    setPassword(null);
    setCopied(null);
  }

  return (
    <section aria-labelledby="password-title" className={styles.panel}>
      <SectionHeader id="password-title">{t("title")}</SectionHeader>
      <div className={styles.panelBody}>
        <p className={styles.muted}>{t("help")}</p>
        {password ? (
          <div role="dialog" aria-label={t("shownTitle")} className={styles.confirm}>
            <span>{t("shownIntro", { name: displayName })}</span>
            <output aria-label={t("shownTitle")} className={styles.secret} translate="no">
              {password}
            </output>
            <p role="alert" className={styles.warning}>
              {t("shownWarning")}
            </p>
            <span className={styles.actions}>
              <Button variant="primary" onClick={copy}>
                {copied === "yes" ? t("copied") : t("copy")}
              </Button>
              <Button variant="secondary" onClick={close}>
                {t("close")}
              </Button>
            </span>
            {copied === "no" && (
              <p role="alert" className={styles.error}>
                {t("copyFailed")}
              </p>
            )}
          </div>
        ) : confirming ? (
          <div role="alertdialog" aria-label={t("reset")} className={styles.confirm}>
            <span>{t("confirm", { name: displayName })}</span>
            <span className={styles.actions}>
              <Button variant="primary" onClick={reset} disabled={busy}>
                {busy ? t("saving") : t("confirmYes")}
              </Button>
              <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
                {t("cancel")}
              </Button>
            </span>
          </div>
        ) : (
          <Button
            variant="secondary"
            onClick={() => {
              setError(null);
              setConfirming(true);
            }}
          >
            {t("reset")}
          </Button>
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
