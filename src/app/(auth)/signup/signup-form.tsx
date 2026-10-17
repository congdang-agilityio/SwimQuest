"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button, Field } from "@/components/ui";
import { safeNextPath } from "@/lib/auth/public-paths";
import styles from "../auth.module.css";

/** NFR-10: links are touch targets too, at least 44x44 CSS px. */
const tap = { display: "inline-flex", alignItems: "center", minHeight: 44, minWidth: 44 } as const;
import { parseSignUp, type SignUpErrors, type SignUpField } from "@/lib/validation/auth";

const FIELDS: { name: SignUpField; type: string; autoComplete: string }[] = [
  { name: "email", type: "email", autoComplete: "email" },
  { name: "password", type: "password", autoComplete: "new-password" },
  { name: "displayName", type: "text", autoComplete: "nickname" },
];

export function SignUpForm({ next }: { next?: string }) {
  const t = useTranslations("auth");
  const [errors, setErrors] = useState<SignUpErrors>({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<"taken" | "failed" | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseSignUp(Object.fromEntries(new FormData(event.currentTarget)));
    setProblem(null);
    setErrors(parsed.ok ? {} : parsed.errors);
    if (!parsed.ok) return;
    setBusy(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (res.status === 201) {
        window.location.assign(safeNextPath(next));
        return;
      }
      setProblem(res.status === 409 ? "taken" : "failed");
    } catch {
      setProblem("failed");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="signup-title" className={styles.form}>
      <h1 id="signup-title" className={styles.title}>
        {t("signup.title")}
      </h1>
      {FIELDS.map(({ name, type, autoComplete }) => {
        const code = errors[name];
        return (
          <Field
            key={name}
            id={name}
            name={name}
            type={type}
            autoComplete={autoComplete}
            label={t(`fields.${name}`)}
            error={code ? t(`errors.${code}`) : undefined}
            onDark
          />
        );
      })}
      {problem && (
        <p role="alert" className={styles.problem}>
          {problem === "taken" ? t("errors.EMAIL_TAKEN") : t("errors.GENERIC")}{" "}
          {problem === "taken" && (
            <a href="/login" className={styles.link} style={tap}>
              {t("signup.loginCta")}
            </a>
          )}
        </p>
      )}
      <Button type="submit" disabled={busy} block>
        {t("signup.submit")}
      </Button>
      <p className={styles.switch}>
        {t("signup.haveAccount")}{" "}
        <a href="/login" className={styles.link} style={tap}>
          {t("signup.loginCta")}
        </a>
      </p>
    </form>
  );
}
