import { SafeImg } from "@/components/art/safe-img";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { EnergyOrb } from "@/components/collectibles/energy-orb";
import { Avatar, Chip } from "@/components/ui";
import { badgeArt } from "@/lib/art/badge-art";
import { profileAvatarSrc } from "@/lib/profile-avatar";
import type { MyTeamMember } from "@/server/teams/my-team-view";
import { HandoverButton } from "./handover-button";
import { RemoveMemberButton } from "./remove-member-button";
import styles from "./my-team.module.css";

/** Every member with verified km and points; the captain is marked by icon plus text. */
export function TeamRoster({
  members,
  handoverTeamId,
  afterStart = false,
}: {
  members: readonly MyTeamMember[];
  /** Set for the captain only: each other member then gets a "Make captain" action. */
  handoverTeamId?: string;
  /** The tournament has started: Remove then warns that the swims stay with the team. */
  afterStart?: boolean;
}) {
  const t = useTranslations("team");
  const tKind = useTranslations("players");
  return (
    <section aria-labelledby="team-roster-title">
      <h2 id="team-roster-title" className={styles.rosterTitle}>
        {t("rosterTitle")}
      </h2>
      <ul className={styles.list}>
        {members.map((m) => (
          <li key={m.id} className={styles.row}>
            <Avatar name={m.displayName} src={profileAvatarSrc(m)} size={44} decorative />
            <span className={styles.who}>
              <span className={styles.nameLine}>
                <Link href={`/players/${m.id}`} className={styles.name}>
                  {m.displayName}
                </Link>
                {m.energyOrb && <EnergyOrb size={26} />}
              </span>
              <span className={styles.tags}>
                {m.isCaptain && (
                  <Chip tone="gold">
                    <span aria-hidden="true">★</span> {t("captain")}
                  </Chip>
                )}
                <Chip tone="info">{t("level", { level: m.level })}</Chip>
                <span>{t("points", { points: m.points })}</span>
              </span>
              {m.badges.length > 0 && (
                <details className={styles.badges}>
                  <summary>{t("badgesSummary", { count: m.badges.length })}</summary>
                  <ul className={styles.badgeList}>
                    {m.badges.map((b) => {
                      const art = badgeArt(b.kind);
                      return (
                        <li key={b.id} className={styles.badge}>
                          {art && <SafeImg src={art.webp} alt="" width={40} height={40} />}
                          <span>{tKind(`kind.${b.kind}`)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              )}
            </span>
            <span className={styles.km}>
              {t("km", { km: Math.round(m.verifiedKm * 100) / 100 })}
            </span>
            {handoverTeamId && !m.isCaptain && (
              <HandoverButton teamId={handoverTeamId} userId={m.id} name={m.displayName} />
            )}
            {handoverTeamId && !m.isCaptain && (
              <RemoveMemberButton
                teamId={handoverTeamId}
                userId={m.id}
                name={m.displayName}
                afterStart={afterStart}
                className={styles.handover}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
