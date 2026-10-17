"use client";

import { useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button, SectionHeader, TextareaField } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import styles from "./admin.module.css";

const MAX_CONTACT = 200;

/** Edits how players reach the platform admin; shown on the forgot-password page (S-59 AC 1). */
export function AdminContactForm({ initial }: { initial: string }) {
  const t = useTranslations("admin.contact");
  const [contact, setContact] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const inFlight = useRef(false);
  const tooLong = contact.trim().length > MAX_CONTACT;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || tooLong) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const res = await clientFetch("/api/admin/settings/contact", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contact }),
      }).catch(() => null);
      if (!res) setError("network");
      else if (res.ok) {
        const body = (await res.json().catch(() => null)) as { contact?: unknown } | null;
        if (typeof body?.contact === "string") setContact(body.contact);
        setDone(true);
      } else {
        const body = await res.json().catch(() => null);
        const code = String(body?.error?.code ?? body?.code ?? "");
        setError(code === "INVALID_ADMIN_CONTACT" || code === "FORBIDDEN" ? code : "failed");
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const fieldError =
    error === "INVALID_ADMIN_CONTACT" || tooLong ? t("errors.INVALID_ADMIN_CONTACT") : undefined;

  return (
    <section aria-labelledby="contact-title" className={styles.panel}>
      <SectionHeader id="contact-title">{t("title")}</SectionHeader>
      <form className={styles.panelBody} onSubmit={save}>
        <p className={styles.muted}>{t("help")}</p>
        <TextareaField
          id="admin-contact"
          label={t("label")}
          hint={t("hint", { max: MAX_CONTACT })}
          error={fieldError}
          value={contact}
          rows={3}
          maxLength={MAX_CONTACT + 50}
          onChange={(e) => {
            setContact(e.target.value);
            setDone(false);
            if (error === "INVALID_ADMIN_CONTACT") setError(null);
          }}
        />
        <Button type="submit" variant="primary" disabled={busy || tooLong}>
          {busy ? t("saving") : t("save")}
        </Button>
        {error && error !== "INVALID_ADMIN_CONTACT" && (
          <p role="alert" className={styles.error}>
            {t(`errors.${error}`)}
          </p>
        )}
        {done && (
          <p role="status" className={styles.ok}>
            {t("done")}
          </p>
        )}
      </form>
    </section>
  );
}
