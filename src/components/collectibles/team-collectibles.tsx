import { useTranslations } from "next-intl";
import { MockupPicture } from "@/components/art/mockup-picture";
import { Card } from "@/components/ui";
import { COLLECTIBLE_ART } from "@/lib/art/collectibles";
import { MAP_FRAGMENT_PERCENTS, type TreasureChestKey } from "@/lib/collectibles/team";
import type { TeamCollectiblesView } from "@/server/collectibles/team-collectibles";
import { TreasureChest } from "./treasure-chest";
import styles from "./collectibles.module.css";

const CHESTS: readonly TreasureChestKey[] = ["HALFWAY", "LY_SON"];

/** The team's fragment slots, the Route 01 map and the chests (two item groups of the card). */
export function TeamCollectiblesGroups({
  collectibles,
  headingLevel = 3,
}: {
  collectibles: TeamCollectiblesView;
  /** Heading level of the two group titles. */
  headingLevel?: 3 | 4;
}) {
  const t = useTranslations("collectibles.team");
  const H = headingLevel === 3 ? "h3" : "h4";
  const owned = new Set(collectibles.mapFragments.map((f) => f.percent));
  const chests = new Map(collectibles.treasureChests.map((c) => [c.chest, c]));
  return (
    <>
      <div className={styles.group}>
        <H className={styles.groupTitle}>{t("fragmentsTitle")}</H>
        <ul className={styles.grid}>
          {MAP_FRAGMENT_PERCENTS.map((percent) => {
            const earned = owned.has(percent);
            return (
              <li
                key={percent}
                className={styles.tile}
                data-testid="map-fragment"
                data-earned={earned}
              >
                <span className={styles.stage}>
                  {earned ? (
                    <MockupPicture
                      artKey={COLLECTIBLE_ART.mapFragment}
                      alt={t("fragmentAlt", { percent })}
                      className={styles.art}
                    />
                  ) : (
                    <span
                      className={styles.slot}
                      role="img"
                      aria-label={t("fragmentMissing", { percent })}
                    >
                      {percent}%
                    </span>
                  )}
                </span>
                <span className={earned ? styles.label : styles.sub}>
                  {t("fragment", { percent })}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className={styles.group}>
        <H className={styles.groupTitle}>{t("rewardsTitle")}</H>
        <ul className={styles.grid}>
          <li
            className={styles.tile}
            data-testid="voyage-map"
            data-complete={collectibles.voyageMapComplete}
          >
            <span className={styles.stage}>
              {collectibles.voyageMapComplete && (
                <MockupPicture artKey="effects/glow" alt="" className={styles.glow} />
              )}
              <MockupPicture
                artKey={COLLECTIBLE_ART.mapFragment}
                alt={t("voyageMapAlt")}
                className={[styles.art, collectibles.voyageMapComplete ? "" : styles.dim].join(" ")}
              />
            </span>
            <span className={styles.label}>{t("voyageMap")}</span>
            {collectibles.voyageMapComplete ? (
              <span className={styles.done}>{t("voyageMapComplete")}</span>
            ) : (
              <span className={styles.sub}>{t("voyageMapProgress", { count: owned.size })}</span>
            )}
          </li>
          {CHESTS.map((key) => {
            const chest = chests.get(key);
            return (
              <li
                key={key}
                className={styles.tile}
                data-testid="treasure-chest"
                data-chest={key}
                data-earned={Boolean(chest)}
              >
                {chest ? (
                  <TreasureChest
                    artKey={chest.artKey}
                    momentKey={chest.momentKey}
                    seen={chest.seen}
                    label={t(`chest.${key}`)}
                    newLabel={t("chestNew")}
                  />
                ) : (
                  <>
                    <span className={styles.stage}>
                      <span
                        className={styles.slot}
                        role="img"
                        aria-label={t("chestMissing", { chest: t(`chest.${key}`) })}
                      >
                        {t(`chestAt.${key}`)}
                      </span>
                    </span>
                    <span className={styles.sub}>{t(`chest.${key}`)}</span>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

/**
 * The team's map fragments, Route 01 voyage map and treasure chests (S-85), styled after the
 * mockup's item panel. Milestones not reached yet are empty slots. Collecting only: no actions.
 */
export function TeamCollectibles({
  collectibles,
  headingId = "team-collectibles-title",
}: {
  collectibles: TeamCollectiblesView;
  headingId?: string;
}) {
  const t = useTranslations("collectibles.team");
  return (
    <Card
      as="section"
      aria-labelledby={headingId}
      className={styles.card}
      data-testid="team-collectibles"
    >
      <h2 id={headingId} className={styles.tab}>
        {t("title")}
      </h2>
      <TeamCollectiblesGroups collectibles={collectibles} />
      <p className={styles.note}>{t("collectOnly")}</p>
    </Card>
  );
}
