import { useTranslations } from "next-intl";
import { TeamEmblem } from "@/components/teams/team-emblem";
import { Chip } from "@/components/ui";
import { mockupArt } from "@/lib/art/mockup-art";
import styles from "./leaderboard.module.css";

export type ValueTableRow = {
  teamId: string;
  name: string;
  emblemKey: string;
  isMyTeam: boolean;
  /** Already formatted with its unit, e.g. "120 points" or "12.5 km". */
  value: string;
};

/** Ranks 1–3 show the gold, silver and bronze medals cut from the asset sheets (art group G2). */
const MEDAL_KEYS = ["medals/medal-gold", "medals/medal-silver", "medals/medal-bronze"];
const medalSrc = (index: number) => {
  const key = MEDAL_KEYS[index];
  return key ? mockupArt(key)?.webp : undefined;
};

export function RankCell({ rank }: { rank: number }) {
  const src = medalSrc(rank - 1);
  return (
    <td className={styles.rankCell}>
      {src ? (
        <span className={styles.medal}>
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny static image */}
          <img src={src} alt="" width={36} height={36} />
          <span className={styles.visuallyHidden}>{rank}</span>
        </span>
      ) : (
        <span className={styles.rank}>{rank}</span>
      )}
    </td>
  );
}

export function TeamCell({ row }: { row: Pick<ValueTableRow, "name" | "emblemKey" | "isMyTeam"> }) {
  const t = useTranslations("leaderboard");
  return (
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
  );
}

/** Points, Total km and Badges tabs: rows arrive ranked by the service; one value column. */
export function ValueTable({
  rows,
  caption,
  valueHeader,
}: {
  rows: ValueTableRow[];
  caption: string;
  valueHeader: string;
}) {
  const t = useTranslations("leaderboard");
  return (
    <table className={styles.table}>
      <caption className={styles.visuallyHidden}>{caption}</caption>
      <thead>
        <tr>
          <th scope="col" className={styles.rankCell}>
            {t("rank")}
          </th>
          <th scope="col">{t("team")}</th>
          <th scope="col" className={styles.num}>
            {valueHeader}
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
            <td className={styles.pct}>{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
