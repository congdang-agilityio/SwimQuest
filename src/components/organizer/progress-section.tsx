import Link from "next/link";
import { useTranslations } from "next-intl";
import styles from "./console.module.css";
import { TierShip } from "@/components/ship/tier-ship";
import { Chip, ProgressBar, SectionHeader } from "@/components/ui";
import { mockupArt } from "@/lib/art/mockup-art";
import { formatProgressPct } from "@/lib/scoring/progress";
import type { ConsoleTeam } from "@/server/organizer/participation";

/** Ranks 1–3 show the G2 medals, as on the mockup's team leaderboard. */
const MEDAL_KEYS = ["medals/medal-gold", "medals/medal-silver", "medals/medal-bronze"];

type Props = {
  tournamentId: string;
  teams: readonly ConsoleTeam[];
};

/** Progress of the organizer console (S-65 AC 5): each team's route progress and active members. */
export function ProgressSection({ tournamentId, teams }: Props) {
  const t = useTranslations("organizer.console.progress");
  const ranked = [...teams].sort((a, b) => b.progressBp - a.progressBp);
  return (
    <section aria-labelledby="console-progress" className={styles.section}>
      <SectionHeader id="console-progress">{t("title")}</SectionHeader>
      <div className={styles.sectionBody}>
        {ranked.length === 0 && <p className={styles.empty}>{t("empty")}</p>}
        <ol className={styles.list}>
          {ranked.map((team, i) => {
            const medal = MEDAL_KEYS[i] ? mockupArt(MEDAL_KEYS[i]) : undefined;
            return (
              <li key={team.teamId} className={styles.progressRow}>
                <span className={styles.rank}>
                  {medal ? (
                    // eslint-disable-next-line @next/next/no-img-element -- tiny static medal art
                    <img src={medal.webp} alt="" width={32} height={32} />
                  ) : (
                    i + 1
                  )}
                  <span className={styles.visuallyHidden}>{t("rank", { rank: i + 1 })}</span>
                </span>
                <TierShip
                  progressBp={team.progressBp}
                  alt={(tier) => t("ship", { tier })}
                  size={44}
                  small
                  className={styles.ship}
                />
                <span className={styles.progressInfo}>
                  <span className={styles.progressHead}>
                    <Link
                      href={`/tournaments/${tournamentId}/manage/teams/${team.teamId}`}
                      className={styles.teamName}
                    >
                      {team.name}
                    </Link>
                    <strong className={styles.pct}>{formatProgressPct(team.progressBp)}</strong>
                  </span>
                  <ProgressBar
                    value={team.progressBp / 100}
                    label={t("barLabel", { name: team.name })}
                    tone="light"
                  />
                  <span className={styles.chips}>
                    <Chip tone={team.activeMembersThisWeek > 0 ? "success" : "neutral"}>
                      {t("active", {
                        count: team.activeMembersThisWeek,
                        total: team.members.length,
                      })}
                    </Chip>
                    {team.finished && <Chip tone="gold">{t("finished")}</Chip>}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
