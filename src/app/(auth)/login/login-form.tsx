"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { safeNextPath } from "@/lib/auth/public-paths";

type Field = "email" | "password";
const FIELDS: { name: Field; type: string; autoComplete: string }[] = [
  { name: "email", type: "email", autoComplete: "email" },
  { name: "password", type: "password", autoComplete: "current-password" },
];
const control = { minHeight: 44, width: "100%", boxSizing: "border-box", padding: 8 } as const;
const errorColor = { color: "#b91c1c" };
/** NFR-10: links are touch targets too, at least 44x44 CSS px. */
const link = { display: "inline-flex", alignItems: "center", minHeight: 44, minWidth: 44 } as const;

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("auth");
  const [missing, setMissing] = useState<Record<Field, boolean>>({ email: false, password: false });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<"invalid" | "failed" | null>(null);
  const safeNext = safeNextPath(next, "");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget)) as Record<Field, string>;
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
    <form onSubmit={onSubmit} noValidate aria-labelledby="login-title">
      <h1 id="login-title">{t("login.title")}</h1>
      {FIELDS.map(({ name, type, autoComplete }) => {
        const invalid = missing[name];
        return (
          <p key={name}>
            <label htmlFor={name}>{t(`fields.${name}`)}</label>
            <input
              id={name}
              name={name}
              type={type}
              autoComplete={autoComplete}
              aria-invalid={invalid ? true : undefined}
              aria-describedby={invalid ? `${name}-error` : undefined}
              style={control}
            />
            {invalid && (
              <span id={`${name}-error`} role="alert" style={errorColor}>
                {t(`errors.${name === "email" ? "EMAIL_REQUIRED" : "PASSWORD_REQUIRED"}`)}
              </span>
            )}
          </p>
        );
      })}
      {problem && (
        <p role="alert" style={errorColor}>
          {problem === "invalid" ? t("errors.INVALID_CREDENTIALS") : t("errors.GENERIC")}
        </p>
      )}
      <button type="submit" disabled={busy} style={control}>
        {t("login.submit")}
      </button>
      <p>
        {t("login.noAccount")}{" "}
        <a
          href={safeNext ? `/signup?next=${encodeURIComponent(safeNext)}` : "/signup"}
          style={link}
        >
          {t("login.signupCta")}
        </a>
      </p>
    </form>
  );
}
