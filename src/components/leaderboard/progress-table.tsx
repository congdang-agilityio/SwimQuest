import { useTranslations } from "next-intl";
import { Chip } from "@/components/ui";
import { TeamEmblem } from "@/components/teams/team-emblem";
import { formatProgressPct } from "@/lib/scoring/progress";
import styles from "./leaderboard.module.css";

export type ProgressTableRow = {
  teamId: string;
  name: string;
  emblemKey: string;
  progressBp: number;
  routeKmReached: number;
  isMyTeam: boolean;
};

/** Ranks 1–3 show the gold, silver and bronze medals cut from the mockup. */
const MEDAL_COUNT = 3;
const medalSrc = (rank: number) => `/art/mockup/screen-leaderboard/medal-${rank}.png`;

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
            <td className={styles.rankCell}>
              {i < MEDAL_COUNT ? (
                <span className={styles.medal}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- tiny static PNG */}
                  <img src={medalSrc(i + 1)} alt="" width={32} height={34} />
                  <span className={styles.visuallyHidden}>{i + 1}</span>
                </span>
              ) : (
                <span className={styles.rank}>{i + 1}</span>
              )}
            </td>
            <th scope="row" className={styles.team}>
              <span className={styles.teamInner}>
                <span className={styles.emblem}>
                  <TeamEmblem emblemKey={row.emblemKey} size={40} alt="" />
                </span>
                <span className={styles.name}>
                  <span>{row.name}</span>
                  {row.isMyTeam && (
                    <Chip tone="gold" className={styles.yourTeam} data-testid="your-team-tag">
                      {t("yourTeam")}
                    </Chip>
                  )}
                </span>
              </span>
            </th>
            <td className={styles.pct}>{formatProgressPct(row.progressBp)}</td>
            <td className={styles.km}>{t("kmValue", { km: row.routeKmReached })}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
