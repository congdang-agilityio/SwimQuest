"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import styles from "./coming-soon-providers.module.css";

type Provider = "google" | "facebook" | "strava";

/** Simple inline brand marks (not mockup art). */
const MARKS: Record<Provider, ReactNode> = {
  google: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={styles.mark}>
      <path
        fill="var(--sq-brand-google-red)"
        d="M12 5.4c1.6 0 3 .6 4.1 1.6l3-3A10.4 10.4 0 0 0 12 1.5 10.5 10.5 0 0 0 2.7 7.3l3.5 2.7A6.3 6.3 0 0 1 12 5.4z"
      />
      <path
        fill="var(--sq-brand-google-blue)"
        d="M22.5 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.9a5 5 0 0 1-2.2 3.3l3.4 2.6c2-1.900 3.4-4.600 3.4-7.8z"
      />
      <path
        fill="var(--sq-brand-google-yellow)"
        d="M6.200 14a6.3 6.3 0 0 1 0-4L2.700 7.300a10.500 10.500 0 0 0 0 9.400L6.200 14z"
      />
      <path
        fill="var(--sq-brand-google-green)"
        d="M12 22.500c2.800 0 5.200-.9 6.900-2.500l-3.4-2.6c-.9.600-2.100 1-3.500 1a6.3 6.3 0 0 1-5.800-4.4l-3.500 2.700A10.500 10.500 0 0 0 12 22.500z"
      />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={styles.mark}>
      <circle cx="12" cy="12" r="11" fill="var(--sq-brand-facebook)" />
      <path
        fill="var(--sq-white)"
        d="M13.3 22v-8h2.700l.4-3.100h-3.100V8.900c0-.9.300-1.500 1.6-1.500h1.700V4.600a22 22 0 0 0-2.500-.1c-2.400 0-4.100 1.500-4.100 4.200v2.2H7.300V14H10v8z"
      />
    </svg>
  ),
  strava: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={styles.mark}>
      <path
        fill="var(--sq-brand-strava)"
        d="m10.100 2 -6.600 12.800h4.900l1.700-3.3 1.700 3.300h4.900z"
      />
      <path
        fill="var(--sq-brand-strava)"
        d="m16 14.800-2.400 4.800-2.400-4.800h-3L13.600 24l5.400-9.200z"
        opacity=".6"
      />
    </svg>
  ),
};

const PROVIDERS: Provider[] = ["google", "facebook", "strava"];

/**
 * Google, Facebook and Strava sign-in, shown as coming soon (Q-33). The buttons are
 * type="button" and aria-disabled: tapping one only shows a note. No OAuth flow, no request.
 */
export function ComingSoonProviders() {
  const t = useTranslations("auth");
  const [tapped, setTapped] = useState<Provider | null>(null);

  return (
    <div role="group" aria-label={t("providers.group")} className={styles.wrap}>
      {PROVIDERS.map((p) => (
        <button
          key={p}
          type="button"
          aria-disabled="true"
          className={`${styles.pill} ${p === "google" ? styles.light : styles.dark}`}
          onClick={() => setTapped(p)}
        >
          {MARKS[p]}
          <span className={styles.label}>
            {t("providers.continue")} {t(`providers.names.${p}`)}
          </span>
          <span className={styles.badge}>{t("providers.comingSoon")}</span>
        </button>
      ))}
      <p role="status" className={styles.note}>
        {tapped ? t("providers.note", { provider: t(`providers.names.${tapped}`) }) : ""}
      </p>
      <p className={styles.divider} aria-hidden="true">
        <span>{t("providers.divider")}</span>
      </p>
    </div>
  );
}
