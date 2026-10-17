"use client";

import { useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button, Field } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import styles from "./change-password-form.module.css";

type FieldName = "current" | "next" | "confirm";
type Errors = Partial<Record<FieldName, string>>;

const FIELDS: { name: FieldName; autoComplete: string }[] = [
  { name: "current", autoComplete: "current-password" },
  { name: "next", autoComplete: "new-password" },
  { name: "confirm", autoComplete: "new-password" },
];

/** Change-password form. Passwords are only sent to the API; they are never shown or logged. */
export function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const t = useTranslations("security");
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget)) as Record<FieldName, string>;
    setDone(false);
    setFailed(false);
    if (!data.current) {
      setErrors({ current: "CURRENT_REQUIRED" });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const res = await clientFetch("/api/me/password", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ current: data.current, next: data.next, confirm: data.confirm }),
      });
      if (res.ok) {
        formRef.current?.reset();
        setDone(true);
        onDone?.();
      } else {
        const body = res.status === 400 ? await res.json().catch(() => null) : null;
        const fields = body?.error?.fields as Errors | undefined;
        if (fields && Object.keys(fields).length > 0) setErrors(fields);
        else setFailed(true);
      }
    } catch {
      setFailed(true);
    }
    setBusy(false);
  }

  const message = (code?: string) => (code ? t(`errors.${code}`) : undefined);

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className={styles.form}>
      {FIELDS.map(({ name, autoComplete }) => (
        <Field
          key={name}
          id={`password-${name}`}
          name={name}
          type="password"
          autoComplete={autoComplete}
          label={t(`change.${name}`)}
          error={message(errors[name])}
        />
      ))}
      {failed && (
        <p role="alert" className={styles.problem}>
          {t("errors.GENERIC")}
        </p>
      )}
      {done && (
        <p role="status" className={styles.success}>
          {t("change.success")}
        </p>
      )}
      <Button type="submit" block disabled={busy}>
        {t("change.submit")}
      </Button>
    </form>
  );
}
