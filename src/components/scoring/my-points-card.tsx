import { useFormatter, useTranslations } from "next-intl";
import styles from "@/components/teams/my-team.module.css";
import { Card } from "@/components/ui";
import type { MyPoints } from "@/server/scoring/my-points";

/** My Team's "My points" card: total, split by kind, and each week's multiplier (story #23). */
export function MyPointsCard({ points }: { points: MyPoints }) {
  const t = useTranslations("scoring.myPoints");
  const format = useFormatter();
  const num = (n: number) => format.number(n);
  // A week at x1.00 earned nothing extra, so it is left out and the rule explains why.
  const weeks = points.weeks.filter((w) => w.multiplierPct > 100);
  const stats = [
    ["total", points.total],
    ["distance", points.distance],
    ["bonuses", points.bonuses],
    ["multiplier", points.multiplierExtra],
  ] as const;
  return (
    <Card as="section" aria-labelledby="my-points-title" className={styles.points}>
      <h2 id="my-points-title" className={styles.startTitle}>
        {t("title")}
      </h2>
      <dl className={styles.pointsGrid}>
        {stats.map(([key, value]) => (
          <div key={key} className={key === "total" ? styles.pointsTotal : styles.pointsStat}>
            <dt className={styles.pointsLabel}>{t(key)}</dt>
            <dd className={styles.pointsValue}>{num(value)}</dd>
          </div>
        ))}
      </dl>
      <h3 className={styles.startTitle}>{t("weeksTitle")}</h3>
      {weeks.length > 0 ? (
        <ul className={styles.weekList}>
          {weeks.map((w) => (
            <li key={w.weekStart}>
              {t("week", {
                date: format.dateTime(new Date(`${w.weekStart}T00:00:00Z`), {
                  day: "numeric",
                  month: "short",
                  timeZone: "UTC",
                }),
                days: w.activeDays,
                multiplier: (w.multiplierPct / 100).toFixed(2),
                points: num(w.extraPoints),
              })}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.note}>{t("none")}</p>
      )}
      <p className={styles.note}>{t("rule")}</p>
    </Card>
  );
}
