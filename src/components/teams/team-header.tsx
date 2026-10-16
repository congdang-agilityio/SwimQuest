import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { MyTeamView } from "@/server/teams/my-team-view";
import { TeamEmblem } from "./team-emblem";

const link = { display: "inline-flex", alignItems: "center", minHeight: 44, minWidth: 44 } as const;

type Props = {
  team: MyTeamView["team"];
  captainName: string | null;
  progressBp: number;
  teamPoints: number;
  memberCount: number;
  /** The team start card, rendered between the description and the progress. */
  children?: ReactNode;
};

/** My Team header: emblem, name, description, captain, progress, points, members and Add swim. */
export function TeamHeader({
  team,
  captainName,
  progressBp,
  teamPoints,
  memberCount,
  children,
}: Props) {
  const t = useTranslations("team");
  return (
    <header>
      <h2>
        <TeamEmblem emblemKey={team.emblemKey} size={48} alt="" /> {team.name}
      </h2>
      {team.description && <p>{team.description}</p>}
      {captainName && (
        <p>
          {t("captain")}: {captainName}
        </p>
      )}
      {children}
      <p>{t("progress", { percent: Math.floor(progressBp / 100) })}</p>
      <p>{t("points", { points: teamPoints })}</p>
      <p>{t("members", { count: memberCount, limit: team.memberLimit })}</p>
      <a href="/connect" style={link}>
        {t("addSwim")}
      </a>
    </header>
  );
}
