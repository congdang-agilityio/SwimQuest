import { useTranslations } from "next-intl";
import { Chip } from "@/components/ui";
import { TeamEmblem } from "@/components/teams/team-emblem";
import { mockupArt } from "@/lib/art/mockup-art";
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

/** Ranks 1–3 show the gold, silver and bronze medals cut from the asset sheets (art group G2). */
const MEDAL_KEYS = ["medals/medal-gold", "medals/medal-silver", "medals/medal-bronze"];
const medalSrc = (index: number) => {
  const key = MEDAL_KEYS[index];
  return key ? mockupArt(key)?.webp : undefined;
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
            <td className={styles.rankCell}>
              {medalSrc(i) ? (
                <span className={styles.medal}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- tiny static image */}
                  <img src={medalSrc(i)} alt="" width={36} height={36} />
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
