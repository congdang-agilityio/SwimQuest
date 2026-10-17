import { useTranslations } from "next-intl";
import { Avatar, Chip } from "@/components/ui";
import { mockupMemberAvatar } from "@/lib/art/mockup-avatars";
import type { MyTeamMember } from "@/server/teams/my-team-view";
import { HandoverButton } from "./handover-button";
import styles from "./my-team.module.css";

/** Every member with verified km and points; the captain is marked by icon plus text. */
export function TeamRoster({
  members,
  handoverTeamId,
}: {
  members: readonly MyTeamMember[];
  /** Set for the captain only: each other member then gets a "Make captain" action. */
  handoverTeamId?: string;
}) {
  const t = useTranslations("team");
  return (
    <section aria-labelledby="team-roster-title">
      <h2 id="team-roster-title" className={styles.rosterTitle}>
        {t("rosterTitle")}
      </h2>
      <ul className={styles.list}>
        {members.map((m) => (
          <li key={m.id} className={styles.row}>
            <Avatar name={m.displayName} src={mockupMemberAvatar(m.id)} size={44} decorative />
            <span className={styles.who}>
              <span className={styles.name}>{m.displayName}</span>
              <span className={styles.tags}>
                {m.isCaptain && (
                  <Chip tone="gold">
                    <span aria-hidden="true">★</span> {t("captain")}
                  </Chip>
                )}
                <Chip tone="info">{t("level", { level: m.level })}</Chip>
                <span>{t("points", { points: m.points })}</span>
              </span>
            </span>
            <span className={styles.km}>
              {t("km", { km: Math.round(m.verifiedKm * 100) / 100 })}
            </span>
            {handoverTeamId && !m.isCaptain && (
              <HandoverButton teamId={handoverTeamId} userId={m.id} name={m.displayName} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
