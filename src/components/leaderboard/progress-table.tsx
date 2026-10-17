import { useTranslations } from "next-intl";
import { formatProgressPct } from "@/lib/scoring/progress";
import styles from "./leaderboard.module.css";
import { RankCell, TeamCell } from "./value-table";

export type ProgressTableRow = {
  teamId: string;
  name: string;
  emblemKey: string;
  progressBp: number;
  routeKmReached: number;
  /** Set once the team has finished the route; shows the finished label. */
  finishedAt?: Date | null;
  isMyTeam: boolean;
};

/** Progress tab: rows arrive already ranked by the service; the table keeps that order. */
export function ProgressTable({ rows }: { rows: ProgressTableRow[] }) {
  const t = useTranslations("leaderboard");
  return (
    <table className={styles.table}>
      <caption className={styles.visuallyHidden}>{t("caption")}</caption>
      <thead>
        <tr>
          <th scope="col" className={styles.rankCell}>
            {t("rank")}
          </th>
          <th scope="col">{t("team")}</th>
          <th scope="col" className={styles.num}>
            {t("progress")}
          </th>
          <th scope="col" className={styles.num}>
            {t("routeKm")}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={row.teamId}
            data-testid={`leaderboard-row-${row.teamId}`}
            data-my-team={row.isMyTeam ? "true" : undefined}
            aria-current={row.isMyTeam ? "true" : undefined}
            className={row.isMyTeam ? styles.mine : undefined}
          >
            <RankCell rank={i + 1} />
            <TeamCell row={row} />
            <td className={styles.pct}>{formatProgressPct(row.progressBp)}</td>
            <td className={styles.km}>{t("kmValue", { km: row.routeKmReached })}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
