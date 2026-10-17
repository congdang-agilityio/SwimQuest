import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { NavIcon } from "@/components/nav/nav-icon";
import { Chip, ProgressBar } from "@/components/ui";
import { MOCKUP_TEAM_EMBLEM } from "@/lib/art/mockup-avatars";
import type { MyTeamView } from "@/server/teams/my-team-view";
import styles from "./my-team.module.css";
import { TeamEmblem } from "./team-emblem";

type Props = {
  team: MyTeamView["team"];
  captainName: string | null;
  progressBp: number;
  teamPoints: number;
  memberCount: number;
  /** Optional extra content, rendered after the progress. */
  children?: ReactNode;
};

/** My Team hero on the navy band: emblem, name, members, captain, description, progress, points. */
export function TeamHeader({
  team,
  captainName,
  progressBp,
  teamPoints,
  memberCount,
  children,
}: Props) {
  const t = useTranslations("team");
  const percent = Math.floor(progressBp / 100);
  return (
    <header className={styles.hero}>
      <div className={styles.identity}>
        <span className={styles.emblem}>
          {team.emblemKey === "wave" ? (
            // eslint-disable-next-line @next/next/no-img-element -- small static art cut from the mockup
            <img src={MOCKUP_TEAM_EMBLEM} alt="" width={88} height={88} />
          ) : (
            <TeamEmblem emblemKey={team.emblemKey} size={88} alt="" />
          )}
        </span>
        <div>
          <h2 className={styles.teamName}>{team.name}</h2>
          <p className={styles.meta}>
            <Chip className={styles.memberChip}>
              <NavIcon name="team" />
              <span>{t("members", { count: memberCount, limit: team.memberLimit })}</span>
            </Chip>
          </p>
        </div>
      </div>
      {captainName && (
        <p className={styles.muted}>
          {t("captain")}: {captainName}
        </p>
      )}
      {team.description && <p className={styles.muted}>{team.description}</p>}
      <ProgressBar
        value={percent}
        label={t("progressLabel")}
        caption={
          <>
            <span>{t("progress", { percent })}</span>
            <Chip tone="gold" className={styles.pointsChip}>
              {t("points", { points: teamPoints })}
            </Chip>
          </>
        }
      />
      {children}
    </header>
  );
}
