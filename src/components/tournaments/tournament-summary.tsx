import { useTranslations } from "next-intl";
import { TeamEmblem } from "@/components/teams/team-emblem";
import { utcToVnParts } from "@/lib/time/vn";

export type SummaryTeam = {
  id: string;
  name: string;
  emblemKey: string;
  /** Places not yet taken (member limit minus active members). */
  freePlaces: number;
};

type Props = {
  name: string;
  description: string;
  seasonStartAt: Date | string;
  seasonEndAt: Date | string;
  routeId: string;
  routeDistanceM: number;
  teams: readonly SummaryTeam[];
};

/** Tournament as players see it. Plain props so the join page can reuse it. */
export function TournamentSummary(props: Props) {
  const t = useTranslations("publish.preview");
  const r = useTranslations("routes");
  const when = (value: Date | string) => {
    const { date, time } = utcToVnParts(new Date(value));
    return `${time} ${date}`;
  };
  const km = Number((props.routeDistanceM / 1000).toFixed(3));
  return (
    <article aria-labelledby="summary-name">
      <h2 id="summary-name">{props.name}</h2>
      {props.description && <p>{props.description}</p>}
      <p>
        {t("seasonStart")}: {when(props.seasonStartAt)}
      </p>
      <p>
        {t("seasonEnd")}: {when(props.seasonEndAt)} ({t("vietnamTime")})
      </p>
      <p>
        {t("route")}: {r(`${props.routeId}.name`)}, {t("distance", { km })}
      </p>
      <h3>{t("teams")}</h3>
      {props.teams.length === 0 && <p>{t("noTeams")}</p>}
      <ul>
        {props.teams.map((team) => (
          <li key={team.id}>
            <TeamEmblem emblemKey={team.emblemKey} size={32} alt="" /> <strong>{team.name}</strong>{" "}
            <span>
              {team.freePlaces > 0 ? t("placesLeft", { count: team.freePlaces }) : t("full")}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}
