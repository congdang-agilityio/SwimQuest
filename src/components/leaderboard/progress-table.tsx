import { useTranslations } from "next-intl";
import { TeamEmblem } from "@/components/teams/team-emblem";
import { formatProgressPct } from "@/lib/scoring/progress";

export type ProgressTableRow = {
  teamId: string;
  name: string;
  emblemKey: string;
  progressBp: number;
  routeKmReached: number;
  isMyTeam: boolean;
};

/** Progress tab: rows arrive already ranked by the service; the table keeps that order. */
export function ProgressTable({ rows }: { rows: ProgressTableRow[] }) {
  const t = useTranslations("leaderboard");
  return (
    <table>
      <caption>{t("caption")}</caption>
      <thead>
        <tr>
          <th scope="col">{t("rank")}</th>
          <th scope="col">{t("team")}</th>
          <th scope="col">{t("progress")}</th>
          <th scope="col">{t("routeKm")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={row.teamId}
            data-testid={`leaderboard-row-${row.teamId}`}
            data-my-team={row.isMyTeam ? "true" : undefined}
            aria-current={row.isMyTeam ? "true" : undefined}
            style={
              row.isMyTeam
                ? { fontWeight: 700, outline: "3px solid #003B66", outlineOffset: "-3px" }
                : undefined
            }
          >
            <td>{i + 1}</td>
            <th scope="row" style={{ fontWeight: "inherit", textAlign: "start" }}>
              <TeamEmblem emblemKey={row.emblemKey} size={32} alt="" /> {row.name}
              {row.isMyTeam && (
                <>
                  {" "}
                  <strong data-testid="your-team-tag">({t("yourTeam")})</strong>
                </>
              )}
            </th>
            <td>{formatProgressPct(row.progressBp)}</td>
            <td>{t("kmValue", { km: row.routeKmReached })}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
