import { useFormatter, useTranslations } from "next-intl";
import { PersonalCollectiblesGrid } from "@/components/collectibles/my-collectibles-card";
import { TeamCollectiblesGroups } from "@/components/collectibles/team-collectibles";
import { Card, SectionHeader } from "@/components/ui";
import type { MyTournamentCollectibles } from "@/server/collectibles/my-collectibles";
import groupStyles from "@/components/collectibles/collectibles.module.css";
import styles from "./collectibles-section.module.css";

const hasTeamItems = (c: MyTournamentCollectibles) =>
  c.team.mapFragments.length > 0 || c.team.treasureChests.length > 0;

/**
 * My Profile: per tournament of an active membership, the player's pearls, starfish and coins
 * (zeros shown with how to earn them) and the team collectibles they hold (S-84, S-85).
 */
export function CollectiblesSection({ items }: { items: MyTournamentCollectibles[] }) {
  const t = useTranslations("collectibles.profile");
  const format = useFormatter();
  if (items.length === 0) return null;
  return (
    <Card
      as="section"
      className={styles.block}
      aria-labelledby="my-collectibles"
      data-testid="profile-collectibles"
    >
      <SectionHeader id="my-collectibles">{t("title")}</SectionHeader>
      <ul className={styles.list}>
        {items.map((c) => (
          <li
            key={c.tournamentId}
            className={styles.tournament}
            data-testid="profile-collectibles-tournament"
          >
            <div className={styles.head}>
              <h3 className={styles.name}>{c.tournamentName}</h3>
              <span className={styles.team}>{t("team", { team: c.teamName })}</span>
            </div>
            <div className={groupStyles.group}>
              <h4 className={groupStyles.groupTitle}>{t("mineTitle")}</h4>
              <PersonalCollectiblesGrid collectibles={c.personal} />
              {c.personal.pearls.length > 0 && (
                <details className={styles.weeks}>
                  <summary>{t("pearlWeeks")}</summary>
                  <ul>
                    {c.personal.pearls.map((p) => (
                      <li key={p.weekStart}>
                        {t("pearlWeek", {
                          date: format.dateTime(new Date(`${p.weekStart}T00:00:00Z`), {
                            dateStyle: "medium",
                            timeZone: "UTC",
                          }),
                        })}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
            {hasTeamItems(c) && <TeamCollectiblesGroups collectibles={c.team} headingLevel={4} />}
          </li>
        ))}
      </ul>
      <p className={styles.note}>{t("collectOnly")}</p>
    </Card>
  );
}
