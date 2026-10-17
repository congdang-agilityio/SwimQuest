"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, SectionHeader } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import styles from "./admin.module.css";

type Props = { userId: string; displayName: string; isPlatformAdmin: boolean };

/** Grants or removes the platform admin role after an in-page confirmation. */
export function AdminRoleToggle({ userId, displayName, isPlatformAdmin }: Props) {
  const t = useTranslations("admin.user");
  const [isAdmin, setIsAdmin] = useState(isPlatformAdmin);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const inFlight = useRef(false);

  async function change() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const res = await clientFetch(`/api/admin/users/${userId}/role`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isPlatformAdmin: !isAdmin }),
      }).catch(() => null);
      if (!res) setError("network");
      else if (res.ok) {
        setIsAdmin(!isAdmin);
        setDone(true);
        setConfirming(false);
      } else {
        const body = await res.json().catch(() => null);
        const code: unknown = body?.error?.code ?? body?.code;
        setError(code === "LAST_ADMIN" ? "LAST_ADMIN" : "failed");
        setConfirming(false);
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const action = isAdmin ? t("remove") : t("grant");
  return (
    <section aria-labelledby="role-title" className={styles.panel}>
      <SectionHeader id="role-title">{t("roleTitle")}</SectionHeader>
      <div className={styles.panelBody}>
        <p className={styles.muted}>{isAdmin ? t("roleHelpOn") : t("roleHelpOff")}</p>
        {confirming ? (
          <div role="alertdialog" aria-label={action} className={styles.confirm}>
            <span>{t(isAdmin ? "confirmRemove" : "confirmGrant", { name: displayName })}</span>
            <span className={styles.actions}>
              <Button onClick={change} disabled={busy}>
                {busy ? t("saving") : t("confirmYes")}
              </Button>
              <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
                {t("cancel")}
              </Button>
            </span>
          </div>
        ) : (
          <Button
            variant={isAdmin ? "secondary" : "primary"}
            onClick={() => {
              setDone(false);
              setError(null);
              setConfirming(true);
            }}
          >
            {action}
          </Button>
        )}
        {error && (
          <p role="alert" className={styles.error}>
            {t(`errors.${error}`)}
          </p>
        )}
        {done && (
          <p role="status" className={styles.ok}>
            {t("done")}
          </p>
        )}
      </div>
    </section>
  );
}
