import { useTranslations } from "next-intl";
import { TeamCollectiblesGroups } from "@/components/collectibles/team-collectibles";
import { Card, SectionHeader } from "@/components/ui";
import type { MyTournamentCollectibles } from "@/server/collectibles/my-collectibles";
import styles from "./collectibles-section.module.css";

const hasTeamItems = (c: MyTournamentCollectibles) =>
  c.team.mapFragments.length > 0 || c.team.treasureChests.length > 0;

/** My Profile: the team collectibles the player holds, one block per tournament (S-85). */
export function CollectiblesSection({ items }: { items: MyTournamentCollectibles[] }) {
  const t = useTranslations("collectibles.profile");
  const shown = items.filter(hasTeamItems);
  if (shown.length === 0) return null;
  return (
    <Card
      as="section"
      className={styles.block}
      aria-labelledby="my-collectibles"
      data-testid="profile-collectibles"
    >
      <SectionHeader id="my-collectibles">{t("title")}</SectionHeader>
      <ul className={styles.list}>
        {shown.map((c) => (
          <li
            key={c.tournamentId}
            className={styles.tournament}
            data-testid="profile-collectibles-tournament"
          >
            <div className={styles.head}>
              <h3 className={styles.name}>{c.tournamentName}</h3>
              <span className={styles.team}>{t("team", { team: c.teamName })}</span>
            </div>
            <TeamCollectiblesGroups collectibles={c.team} headingLevel={4} />
          </li>
        ))}
      </ul>
      <p className={styles.note}>{t("collectOnly")}</p>
    </Card>
  );
}
