import { useTranslations } from "next-intl";
import { MockupPicture } from "@/components/art/mockup-picture";
import { TeamEmblem } from "@/components/teams/team-emblem";
import { Card, Chip } from "@/components/ui";
import { imageSrc } from "@/lib/profile-avatar";
import { utcToVnParts } from "@/lib/time/vn";
import styles from "./tournament-summary.module.css";

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
  /** Leave out the team list when the page shows the teams elsewhere (the join picker). */
  hideTeams?: boolean;
  /** The organizer's uploaded banner and logo; without a banner the sea template shows. */
  bannerImageId?: string | null;
  logoImageId?: string | null;
};

/** Tournament as players see it. Plain props so the join page can reuse it. */
export function TournamentSummary(props: Props) {
  const t = useTranslations("publish.preview");
  const r = useTranslations("routes");
  const when = (value: Date | string) => {
    const { date, time } = utcToVnParts(new Date(value));
    return `${time} ${date}`;
  };
  const banner = imageSrc(props.bannerImageId);
  const logo = imageSrc(props.logoImageId);
  const km = Number((props.routeDistanceM / 1000).toFixed(3));
  return (
    <Card as="article" aria-labelledby="summary-name" className={styles.summary}>
      {/* The route's destination, Ly Son, as on the mockup's tournament cards. */}
      <div className={styles.hero}>
        {banner ? (
          // eslint-disable-next-line @next/next/no-img-element -- organizer upload, served by the images API
          <img src={banner} alt="" className={styles.scene} />
        ) : (
          <MockupPicture
            artKey="scenes/sea-ly-son-16x9"
            alt=""
            className={styles.scene}
            eager
            fallback={<div className={styles.sceneFallback} />}
          />
        )}
      </div>
      <div className={styles.body}>
        <div className={styles.nameRow}>
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element -- organizer upload, served by the images API
            <img src={logo} alt="" className={styles.logo} />
          )}
          <h2 id="summary-name" className={styles.name}>
            {props.name}
          </h2>
        </div>
        {props.description && <p className={styles.description}>{props.description}</p>}
        <p className={styles.meta}>
          {t("seasonStart")}: {when(props.seasonStartAt)}
        </p>
        <p className={styles.meta}>
          {t("seasonEnd")}: {when(props.seasonEndAt)} ({t("vietnamTime")})
        </p>
        <p className={styles.meta}>
          {t("route")}: {r(`${props.routeId}.name`)}, {t("distance", { km })}
        </p>
        {!props.hideTeams && (
          <>
            <h3 className={styles.teamsTitle}>{t("teams")}</h3>
            {props.teams.length === 0 && <p className={styles.meta}>{t("noTeams")}</p>}
            <ul className={styles.teams}>
              {props.teams.map((team) => (
                <li key={team.id} className={styles.team}>
                  <TeamEmblem emblemKey={team.emblemKey} size={40} alt="" />
                  <strong className={styles.teamName}>{team.name}</strong>
                  <Chip tone={team.freePlaces > 0 ? "info" : "neutral"}>
                    {team.freePlaces > 0 ? t("placesLeft", { count: team.freePlaces }) : t("full")}
                  </Chip>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}
