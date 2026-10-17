"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button, Field } from "@/components/ui";
import { safeNextPath } from "@/lib/auth/public-paths";
import styles from "../auth.module.css";

/** NFR-10: links are touch targets too, at least 44x44 CSS px. */
const tap = { display: "inline-flex", alignItems: "center", minHeight: 44, minWidth: 44 } as const;

type FieldName = "email" | "password";
const FIELDS: { name: FieldName; type: string; autoComplete: string }[] = [
  { name: "email", type: "email", autoComplete: "email" },
  { name: "password", type: "password", autoComplete: "current-password" },
];

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("auth");
  const [missing, setMissing] = useState<Record<FieldName, boolean>>({
    email: false,
    password: false,
  });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<"invalid" | "failed" | null>(null);
  const safeNext = safeNextPath(next, "");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget)) as Record<FieldName, string>;
    const empty = { email: !data.email?.trim(), password: !data.password };
    setProblem(null);
    setMissing(empty);
    if (empty.email || empty.password) return;
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });
      if (res.status === 200) {
        window.location.assign(safeNextPath(next));
        return;
      }
      setProblem(res.status === 401 || res.status === 400 ? "invalid" : "failed");
    } catch {
      setProblem("failed");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="login-title" className={styles.form}>
      <h1 id="login-title" className={styles.title}>
        {t("login.title")}
      </h1>
      {FIELDS.map(({ name, type, autoComplete }) => (
        <Field
          key={name}
          id={name}
          name={name}
          type={type}
          autoComplete={autoComplete}
          label={t(`fields.${name}`)}
          error={
            missing[name]
              ? t(`errors.${name === "email" ? "EMAIL_REQUIRED" : "PASSWORD_REQUIRED"}`)
              : undefined
          }
          onDark
        />
      ))}
      {problem && (
        <p role="alert" className={styles.problem}>
          {problem === "invalid" ? t("errors.INVALID_CREDENTIALS") : t("errors.GENERIC")}
        </p>
      )}
      <Button type="submit" disabled={busy} block>
        {t("login.submit")}
      </Button>
      <p className={styles.switch}>
        {t("login.noAccount")}{" "}
        <a
          href={safeNext ? `/signup?next=${encodeURIComponent(safeNext)}` : "/signup"}
          className={styles.link}
          style={tap}
        >
          {t("login.signupCta")}
        </a>
      </p>
    </form>
  );
}
