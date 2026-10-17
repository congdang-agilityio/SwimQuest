import { useTranslations } from "next-intl";
import console from "./console.module.css";
import styles from "./metrics.module.css";
import { ProgressBar, SectionHeader } from "@/components/ui";
import type { TournamentMetrics } from "@/server/organizer/metrics";

const dayMonth = (weekStart: string) => `${weekStart.slice(8, 10)}/${weekStart.slice(5, 7)}`;

/** Participation and verification of the organizer Metrics page (S-80 AC 2, 3 and 5). */
export function MetricsOverview({ metrics }: { metrics: TournamentMetrics }) {
  const t = useTranslations("metrics");
  const { participation: p, verification: v } = metrics;
  const peak = Math.max(1, ...p.weeklyActiveSwimmers.map((w) => w.swimmers));
  const minutes = v.medianMinutesToDecision;
  return (
    <>
      <section aria-labelledby="metrics-participation" className={console.section}>
        <SectionHeader id="metrics-participation">{t("participation.title")}</SectionHeader>
        <div className={console.sectionBody}>
          <dl className={styles.stats}>
            <div className={styles.stat}>
              <dt className={styles.statLabel}>{t("participation.membersJoined")}</dt>
              <dd className={styles.statValue}>{p.membersJoined}</dd>
            </div>
          </dl>
          <h3 className={console.teamName}>{t("participation.weekly.title")}</h3>
          <p className={styles.hint}>{t("participation.weekly.hint")}</p>
          {p.weeklyActiveSwimmers.length === 0 ? (
            <p className={console.empty}>{t("participation.weekly.empty")}</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">{t("participation.weekly.weekHeader")}</th>
                    <th scope="col" className={styles.num}>
                      {t("participation.weekly.swimmers")}
                    </th>
                    <th scope="col" className={styles.barCell}>
                      <span className={console.visuallyHidden}>
                        {t("participation.weekly.swimmers")}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {p.weeklyActiveSwimmers.map((w) => (
                    <tr key={w.weekStart}>
                      <th scope="row">
                        {t("participation.weekly.week", { date: dayMonth(w.weekStart) })}
                      </th>
                      <td className={styles.num}>{w.swimmers}</td>
                      <td className={styles.barCell} aria-hidden="true">
                        <ProgressBar
                          value={(w.swimmers * 100) / peak}
                          label={t("participation.weekly.swimmers")}
                          tone="light"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h3 className={console.teamName}>{t("participation.teams.title")}</h3>
          {p.activeMembersPerTeam.length === 0 ? (
            <p className={console.empty}>{t("participation.teams.empty")}</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">{t("participation.teams.team")}</th>
                    <th scope="col" className={styles.num}>
                      {t("participation.teams.active")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {p.activeMembersPerTeam.map((team) => (
                    <tr key={team.teamId}>
                      <th scope="row">{team.teamName}</th>
                      <td className={styles.num}>{team.activeMembers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
      <section aria-labelledby="metrics-verification" className={console.section}>
        <SectionHeader id="metrics-verification">{t("verification.title")}</SectionHeader>
        <div className={console.sectionBody}>
          <p className={styles.hint}>{t("verification.hint")}</p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t("verification.status")}</th>
                  <th scope="col" className={styles.num}>
                    {t("verification.count")}
                  </th>
                  <th scope="col" className={styles.num}>
                    {t("verification.share")}
                  </th>
                  <th scope="col" className={styles.barCell}>
                    <span className={console.visuallyHidden}>{t("verification.share")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {v.shares.map((s) => (
                  <tr key={s.status}>
                    <th scope="row">{t(`verification.statuses.${s.status}`)}</th>
                    <td className={styles.num}>{s.count}</td>
                    <td className={styles.num}>
                      {t("verification.shareValue", { pct: s.sharePct })}
                    </td>
                    <td className={styles.barCell} aria-hidden="true">
                      <ProgressBar
                        value={s.sharePct}
                        label={t(`verification.statuses.${s.status}`)}
                        tone="light"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className={console.teamName}>{t("verification.median.title")}</h3>
          <p className={styles.median}>
            {minutes === null
              ? t("verification.median.none")
              : minutes < 60
                ? t("verification.median.minutes", { minutes: Math.round(minutes) })
                : t("verification.median.hours", {
                    hours: Math.floor(minutes / 60),
                    minutes: Math.round(minutes % 60),
                  })}
          </p>
        </div>
      </section>
    </>
  );
}
