"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui";
import styles from "./swims.module.css";

const SOURCES = ["garmin", "strava", "coros", "suunto"] as const;
type Source = (typeof SOURCES)[number];

/**
 * "Nguồn ghi nhận" row of the mockup: Garmin, Strava, Coros and Suunto, all coming soon.
 * aria-disabled buttons that only show a note: no navigation, no request.
 */
export function ComingSoonSources() {
  const t = useTranslations("swims.sources");
  const [tapped, setTapped] = useState<Source | null>(null);
  return (
    <Card as="section" aria-labelledby="sources-title">
      <h2 id="sources-title" className={styles.sourcesTitle}>
        {t("title")}
      </h2>
      <ul className={styles.sources}>
        {SOURCES.map((s) => (
          <li key={s}>
            <button
              type="button"
              aria-disabled="true"
              className={styles.source}
              onClick={() => setTapped(s)}
            >
              <span className={styles.sourceName}>{t(`names.${s}`)}</span>
              <span className={styles.sourceBadge}>{t("comingSoon")}</span>
            </button>
          </li>
        ))}
      </ul>
      <p role="status" className={styles.sourcesNote}>
        {tapped ? t("note", { source: t(`names.${tapped}`) }) : ""}
      </p>
    </Card>
  );
}
