import { useFormatter, useTranslations } from "next-intl";
import { MockupPicture } from "@/components/art/mockup-picture";
import { Card } from "@/components/ui";
import { COLLECTIBLE_ART } from "@/lib/art/collectibles";
import type { PersonalCollectibles } from "@/server/collectibles/personal";
import styles from "./collectibles.module.css";

const ITEMS = [
  ["pearl", COLLECTIBLE_ART.pearl],
  ["starfish", COLLECTIBLE_ART.starfish],
  ["coin", COLLECTIBLE_ART.coin],
] as const;

/** Pearls, starfish and coins as three art tiles with their counts and how each is earned. */
export function PersonalCollectiblesGrid({
  collectibles,
}: {
  collectibles: Pick<PersonalCollectibles, "pearls" | "starfish" | "coins">;
}) {
  const t = useTranslations("collectibles.mine");
  const format = useFormatter();
  const counts = {
    pearl: collectibles.pearls.length,
    starfish: collectibles.starfish.length,
    coin: collectibles.coins,
  };
  return (
    <ul className={[styles.grid, styles.mineGrid].join(" ")}>
      {ITEMS.map(([key, artKey]) => (
        <li
          key={key}
          className={styles.tile}
          data-testid={`collectible-${key}`}
          data-count={counts[key]}
          aria-label={t("count", { label: t(key), count: counts[key] })}
        >
          <span className={styles.stage}>
            <MockupPicture artKey={artKey} alt="" className={styles.art} />
          </span>
          <span className={styles.count} aria-hidden="true">
            {format.number(counts[key])}
          </span>
          <span className={styles.label} aria-hidden="true">
            {t(key)}
          </span>
          <span className={styles.sub} aria-hidden="true">
            {t(`${key}Hint`)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** My Team: my pearls, starfish and coins in the selected tournament (S-84). Collecting only. */
export function MyCollectiblesCard({ collectibles }: { collectibles: PersonalCollectibles }) {
  const t = useTranslations("collectibles.mine");
  return (
    <Card
      as="section"
      aria-labelledby="my-collectibles-title"
      className={styles.card}
      data-testid="my-collectibles"
    >
      <h2 id="my-collectibles-title" className={styles.tab}>
        {t("title")}
      </h2>
      <div className={styles.group}>
        <PersonalCollectiblesGrid collectibles={collectibles} />
      </div>
      <p className={styles.note}>{t("collectOnly")}</p>
    </Card>
  );
}
