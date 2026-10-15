"use client";

import { useTranslations } from "next-intl";
import styles from "./states.module.css";

/** Plain-language error with a retry button. */
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("states.error");
  return (
    <section role="alert">
      <h2>{t("title")}</h2>
      <p>{t("body")}</p>
      <button type="button" className={styles.tap} onClick={onRetry}>
        {t("retry")}
      </button>
    </section>
  );
}
