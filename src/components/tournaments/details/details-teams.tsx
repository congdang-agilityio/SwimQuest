import { useTranslations } from "next-intl";
import { TeamEmblem } from "@/components/teams/team-emblem";
import { Chip } from "@/components/ui";
import styles from "./details.module.css";

type Team = { id: string; name: string; emblemKey: string; freePlaces: number };

/** Teams of the tournament with the places each still has. */
export function DetailsTeams({ teams }: { teams: readonly Team[] }) {
  const t = useTranslations("details");
  return (
    <section aria-labelledby="details-teams" className={styles.head}>
      <h3 id="details-teams" className={styles.teamsTitle}>
        {t("teams")}
      </h3>
      {teams.length === 0 && <p className={styles.empty}>{t("noTeams")}</p>}
      <ul className={styles.teams}>
        {teams.map((team) => (
          <li key={team.id} className={styles.team}>
            <TeamEmblem emblemKey={team.emblemKey} size={40} alt="" />
            <strong className={styles.teamName}>{team.name}</strong>
            <Chip tone={team.freePlaces > 0 ? "info" : "neutral"}>
              {team.freePlaces > 0 ? t("placesLeft", { count: team.freePlaces }) : t("full")}
            </Chip>
          </li>
        ))}
      </ul>
    </section>
  );
}
