import { useFormatter, useTranslations } from "next-intl";
import { BadgeImage } from "@/components/badges/badge-image";
import { Card, SectionHeader } from "@/components/ui";
import type { BadgeListItem } from "@/server/badges/list";
import styles from "./badges-section.module.css";

/** Every badge the player holds, from all tournaments, each with its tournament and date. */
export function BadgesSection({ badges }: { badges: BadgeListItem[] }) {
  const t = useTranslations("profile.badges");
  const format = useFormatter();
  return (
    <Card as="section" className={styles.block} aria-labelledby="my-badges">
      <SectionHeader id="my-badges">{t("title")}</SectionHeader>
      {badges.length === 0 ? (
        <p className={styles.empty}>{t("empty")}</p>
      ) : (
        <ul className={styles.grid}>
          {badges.map((b) => (
            <li key={b.id} className={styles.item}>
              <BadgeImage kind={b.kind} />
              <span className={styles.tournament}>{b.tournament.name}</span>
              <time className={styles.date} dateTime={b.awardedAt.toISOString()}>
                {format.dateTime(b.awardedAt, {
                  dateStyle: "medium",
                  timeZone: "Asia/Ho_Chi_Minh",
                })}
              </time>
              {b.reason && (
                <span className={styles.reason}>{t("reason", { reason: b.reason })}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
