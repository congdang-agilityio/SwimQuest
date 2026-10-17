import Link from "next/link";
import { useTranslations } from "next-intl";
import styles from "./console.module.css";
import { TeamEmblem } from "@/components/teams/team-emblem";
import { Avatar, Chip, SectionHeader } from "@/components/ui";
import { profileAvatarSrc } from "@/lib/profile-avatar";
import type { ConsoleTeam } from "@/server/organizer/participation";

type Props = {
  tournamentId: string;
  teams: readonly ConsoleTeam[];
  /** Players with no active team; links to "Players without a team" when there are any. */
  unassignedCount: number;
};

/** "Teams and players" of the organizer console (S-65 AC 3): members, captain and free places. */
export function TeamsSection({ tournamentId, teams, unassignedCount }: Props) {
  const t = useTranslations("organizer.console.teams");
  return (
    <section aria-labelledby="console-teams" className={styles.section}>
      <SectionHeader id="console-teams">{t("title")}</SectionHeader>
      <div className={styles.sectionBody}>
        {teams.length === 0 && <p className={styles.empty}>{t("empty")}</p>}
        <ul className={styles.list}>
          {teams.map((team) => (
            <li key={team.teamId} className={styles.teamCard}>
              <div className={styles.teamHead}>
                <TeamEmblem emblemKey={team.emblemKey} size={44} alt="" />
                <span className={styles.teamInfo}>
                  <Link
                    href={`/tournaments/${tournamentId}/manage/teams/${team.teamId}`}
                    className={styles.teamName}
                  >
                    {team.name}
                  </Link>
                  <span className={styles.chips}>
                    <Chip tone="info">
                      {t("members", { count: team.members.length, limit: team.memberLimit })}
                    </Chip>
                    <Chip tone={team.freePlaces > 0 ? "success" : "neutral"}>
                      {t("free", { count: team.freePlaces })}
                    </Chip>
                  </span>
                </span>
              </div>
              <p className={styles.captain}>
                {team.captain ? t("captain", { name: team.captain.displayName }) : t("noCaptain")}
              </p>
              {team.members.length > 0 && (
                <ul className={styles.members} aria-label={t("membersOf", { name: team.name })}>
                  {team.members.map((m) => (
                    <li key={m.id} className={styles.member}>
                      <Avatar name={m.displayName} src={profileAvatarSrc(m)} size={28} decorative />
                      <span>{m.displayName}</span>
                      {m.isCaptain && <Chip tone="gold">{t("captainTag")}</Chip>}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        <p className={styles.footer}>
          {unassignedCount > 0 ? (
            <Link href="#unassigned-title" className={styles.footerLink}>
              {t("unassigned", { count: unassignedCount })}
            </Link>
          ) : (
            t("allAssigned")
          )}
        </p>
      </div>
    </section>
  );
}
