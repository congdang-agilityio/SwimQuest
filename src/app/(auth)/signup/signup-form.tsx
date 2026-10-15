"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { parseSignUp, type SignUpErrors, type SignUpField } from "@/lib/validation/auth";

const FIELDS: { name: SignUpField; type: string; autoComplete: string }[] = [
  { name: "email", type: "email", autoComplete: "email" },
  { name: "password", type: "password", autoComplete: "new-password" },
  { name: "displayName", type: "text", autoComplete: "nickname" },
];
const control = { minHeight: 44, width: "100%", boxSizing: "border-box", padding: 8 } as const;
const errorColor = { color: "#b91c1c" };
/** NFR-10: links are touch targets too, at least 44x44 CSS px. */
const link = { display: "inline-flex", alignItems: "center", minHeight: 44, minWidth: 44 } as const;

/** A same-site relative path (one leading slash, no scheme or backslash), else `/home`. */
export function safeNext(next: string | undefined): string {
  if (!next || !/^\/(?![/\\])/.test(next) || /[\\\u0000-\u001f]/.test(next)) return "/home";
  return next;
}

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
        window.location.assign(safeNext(next));
        return;
      }
      setProblem(res.status === 409 ? "taken" : "failed");
    } catch {
      setProblem("failed");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="signup-title">
      <h1 id="signup-title">{t("signup.title")}</h1>
      {FIELDS.map(({ name, type, autoComplete }) => {
        const code = errors[name];
        return (
          <p key={name}>
            <label htmlFor={name}>{t(`fields.${name}`)}</label>
            <input
              id={name}
              name={name}
              type={type}
              autoComplete={autoComplete}
              aria-invalid={code ? true : undefined}
              aria-describedby={code ? `${name}-error` : undefined}
              style={control}
            />
            {code && (
              <span id={`${name}-error`} role="alert" style={errorColor}>
                {t(`errors.${code}`)}
              </span>
            )}
          </p>
        );
      })}
      {problem && (
        <p role="alert" style={errorColor}>
          {problem === "taken" ? t("errors.EMAIL_TAKEN") : t("errors.GENERIC")}{" "}
          {problem === "taken" && (
            <a href="/login" style={link}>
              {t("signup.loginCta")}
            </a>
          )}
        </p>
      )}
      <button type="submit" disabled={busy} style={control}>
        {t("signup.submit")}
      </button>
      <p>
        {t("signup.haveAccount")}{" "}
        <a href="/login" style={link}>
          {t("signup.loginCta")}
        </a>
      </p>
    </form>
  );
}
