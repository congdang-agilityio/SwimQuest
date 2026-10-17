import { useFormatter, useTranslations } from "next-intl";
import { Card, ProgressBar, SectionHeader } from "@/components/ui";
import type { PlayerStats } from "@/server/profile/stats";
import styles from "./stats-section.module.css";

/** The player's verified stats, read-only, with Route 01 progress for each current team. */
export function StatsSection({
  stats,
  teamNames,
}: {
  stats: PlayerStats;
  /** Team names by team id, for the progress rows. */
  teamNames: Record<string, string>;
}) {
  const t = useTranslations("profile.stats");
  const format = useFormatter();
  const num = (n: number) => format.number(n);
  const km = format.number(stats.verifiedDistanceM / 1000, { maximumFractionDigits: 1 });
  const items: [string, string][] = [
    [t("swims"), num(stats.verifiedSwims)],
    [t("distance"), `${km} ${t("km")}`],
    [t("activeDays"), num(stats.activeDays)],
    [t("tournaments"), num(stats.tournamentsJoined)],
    [t("teams"), num(stats.teams)],
    [t("badges"), num(stats.badges)],
  ];
  return (
    <Card as="section" className={styles.stats} aria-labelledby="my-stats">
      <div className={styles.head}>
        <SectionHeader id="my-stats">{t("title")}</SectionHeader>
      </div>
      <dl className={styles.list}>
        {items.map(([label, value]) => (
          <div key={label} className={styles.stat}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {stats.currentProgress.length > 0 && (
        <div className={styles.progress}>
          <h3 className={styles.sub}>{t("progressTitle")}</h3>
          {stats.currentProgress.map((p) => {
            const name = teamNames[p.teamId] ?? "";
            const { routeKmReached, routeKmTotal, progressBp } = p.progress;
            return (
              <ProgressBar
                key={p.teamId}
                tone="light"
                value={progressBp / 100}
                label={t("progressLabel", { team: name })}
                caption={t("progressCaption", {
                  team: name,
                  reached: format.number(routeKmReached, { maximumFractionDigits: 1 }),
                  total: format.number(routeKmTotal, { maximumFractionDigits: 1 }),
                })}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}
