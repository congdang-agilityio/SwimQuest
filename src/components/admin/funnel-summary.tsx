import { getTranslations } from "next-intl/server";
import type { PlatformMetrics } from "@/server/admin/platform-metrics";
import styles from "./metrics.module.css";

/** Funnel steps with the conversion between them, the event counts and the failure counts. */
export async function FunnelSummary({ metrics }: { metrics: PlatformMetrics }) {
  const t = await getTranslations("admin.metrics");
  const max = Math.max(1, ...metrics.steps.map((s) => s.users));
  return (
    <>
      <section className={styles.panel} aria-labelledby="metrics-funnel">
        <h2 id="metrics-funnel" className={styles.band}>
          {t("funnel.title")}
        </h2>
        <ol className={styles.steps}>
          {metrics.steps.map((s) => (
            <li key={s.key} className={styles.step}>
              <span className={styles.stepName}>{t(`funnel.steps.${s.key}`)}</span>
              <strong className={styles.stepValue}>{t("funnel.users", { count: s.users })}</strong>
              <span className={styles.stepRate}>
                {s.conversionPct === null ? "" : t("funnel.conversion", { pct: s.conversionPct })}
              </span>
              <span className={styles.bar} aria-hidden="true">
                <span className={styles.barFill} style={{ width: `${(s.users / max) * 100}%` }} />
              </span>
            </li>
          ))}
        </ol>
        <p className={styles.note}>{t("funnel.note")}</p>
      </section>

      <section className={styles.panel} aria-labelledby="metrics-events">
        <h2 id="metrics-events" className={styles.band}>
          {t("events.title")}
        </h2>
        {metrics.events.length ? (
          <ul className={styles.rows}>
            {metrics.events.map((e) => (
              <li key={e.name} className={styles.rowItem}>
                <code>{e.name}</code>
                <strong>{e.count}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.note}>{t("events.empty")}</p>
        )}
      </section>

      <section className={styles.panel} aria-labelledby="metrics-health">
        <h2 id="metrics-health" className={styles.band}>
          {t("health.title")}
        </h2>
        <div className={styles.healthGrid}>
          {metrics.health.map((h) => (
            <article key={h.kind} className={styles.healthCard}>
              <h3>{t(`health.kinds.${h.kind}`)}</h3>
              <p className={styles.healthCounts}>
                <span>{t("health.last7", { count: h.last7Days })}</span>
                <span>{t("health.last30", { count: h.last30Days })}</span>
              </p>
              {h.topPaths.length ? (
                <>
                  <p className={styles.note}>{t("health.topPaths")}</p>
                  <ul className={styles.rows}>
                    {h.topPaths.map((p) => (
                      <li key={p.path} className={styles.rowItem}>
                        <code className={styles.path}>{p.path}</code>
                        <strong>{p.count}</strong>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className={styles.note}>{t("health.none")}</p>
              )}
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
