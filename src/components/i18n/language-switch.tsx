"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import styles from "./language-switch.module.css";

const OPTIONS = [
  { locale: "vi", short: "VI", name: "Tiếng Việt" },
  { locale: "en", short: "EN", name: "English" },
] as const;

/**
 * Compact VI/EN segmented control. Saves the choice with `PUT /api/locale` (cookie, and the
 * account when signed in), then refreshes so the whole app re-renders in that language.
 * Language names are always written in their own language; the current one is aria-pressed.
 * `tone="dark"` is for the deep-blue auth page, the default for light surfaces.
 */
export function LanguageSwitch({ tone = "light" }: { tone?: "light" | "dark" }) {
  const t = useTranslations("common");
  const current = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function choose(locale: string) {
    if (locale === current || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/locale", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      if (!res.ok) throw new Error("locale");
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        role="group"
        aria-label={t("language.label")}
        className={`${styles.switch} ${tone === "dark" ? styles.dark : ""}`}
      >
        {OPTIONS.map(({ locale, short, name }) => (
          <button
            key={locale}
            type="button"
            lang={locale}
            className={styles.option}
            aria-pressed={current === locale}
            aria-label={name}
            title={name}
            disabled={busy}
            onClick={() => choose(locale)}
          >
            {short}
          </button>
        ))}
      </div>
      {failed && <span role="alert">{t("language.failed")}</span>}
    </>
  );
}
