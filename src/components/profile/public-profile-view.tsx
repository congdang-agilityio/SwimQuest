import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Avatar, Card, Chip, SectionHeader } from "@/components/ui";
import { badgeArt } from "@/lib/art/badge-art";
import { mockupMemberAvatar } from "@/lib/art/mockup-avatars";
import { regionName } from "@/lib/regions";
import type { PublicProfile } from "@/server/profile/public-profile";
import styles from "./public-profile-view.module.css";

/**
 * A player's profile as the viewer may see it. A part the viewer may not see arrives as null and
 * is left out entirely (no placeholder, no blur), so nothing hints at what it held.
 */
export function PublicProfileView({
  profile,
  preview = false,
}: {
  profile: PublicProfile;
  preview?: boolean;
}) {
  const t = useTranslations("players");
  const format = useFormatter();
  const locale = useLocale() === "en" ? "en" : "vi";
  const name = profile.displayName ?? t("hiddenName");
  const region = regionName(profile.regionCode, locale);
  const { stats, goals, badges } = profile;
  const num = (n: number) => format.number(n);
  return (
    <main className={styles.page}>
      <h1 className={styles.srOnly}>{t("title")}</h1>
      {preview && (
        <p className={styles.preview} role="status">
          {t("preview")}
        </p>
      )}

      <Card tone="dark" as="section" className={styles.hero} aria-label={name}>
        <Avatar
          name={name}
          src={profile.avatar ? mockupMemberAvatar(profile.id) : null}
          size={84}
          decorative
        />
        <span className={styles.name}>{name}</span>
        {region && <span className={styles.region}>{t("region", { name: region })}</span>}
      </Card>

      {profile.bio && (
        <Card as="section" className={styles.block} aria-labelledby="pp-bio">
          <SectionHeader id="pp-bio">{t("bioTitle")}</SectionHeader>
          <p className={styles.text}>{profile.bio}</p>
        </Card>
      )}

      {goals && (goals.text || goals.distanceM || goals.disciplines.length > 0) && (
        <Card as="section" className={styles.block} aria-labelledby="pp-goals">
          <SectionHeader id="pp-goals">{t("goalsTitle")}</SectionHeader>
          {goals.text && <p className={styles.text}>{goals.text}</p>}
          <div className={styles.chips}>
            {goals.distanceM ? (
              <Chip tone="info">
                {t("goalDistance", { km: format.number(goals.distanceM / 1000) })}
              </Chip>
            ) : null}
            {goals.disciplines.map((d) => (
              <Chip key={d}>{d}</Chip>
            ))}
          </div>
        </Card>
      )}

      {stats && (
        <Card as="section" className={styles.stats} aria-labelledby="pp-stats">
          <h2 id="pp-stats" className={styles.statsTitle}>
            {t("statsTitle")}
          </h2>
          <dl className={styles.statList}>
            <Stat label={t("swims")} value={num(stats.verifiedSwims)} />
            <Stat
              label={t("distance")}
              value={`${format.number(stats.verifiedDistanceM / 1000, { maximumFractionDigits: 1 })} ${t("km")}`}
            />
            <Stat label={t("activeDays")} value={num(stats.activeDays)} />
            <Stat label={t("tournaments")} value={num(stats.tournamentsJoined)} />
            <Stat label={t("teams")} value={num(stats.teams)} />
            <Stat label={t("badgesStat")} value={num(stats.badges)} />
          </dl>
        </Card>
      )}

      {badges && (
        <Card as="section" className={styles.block} aria-labelledby="pp-badges">
          <SectionHeader id="pp-badges">{t("badgesTitle")}</SectionHeader>
          {badges.length === 0 ? (
            <p className={styles.text}>{t("noBadges")}</p>
          ) : (
            <ul className={styles.grid}>
              {badges.map((b) => {
                const art = badgeArt(b.kind);
                return (
                  <li key={b.id} className={styles.badge}>
                    {art && (
                      // eslint-disable-next-line @next/next/no-img-element -- small static art
                      <img src={art.webp} alt="" width={64} height={64} />
                    )}
                    <span className={styles.badgeKind}>{t(`kind.${b.kind}`)}</span>
                    <span className={styles.badgeTour}>{b.tournament.name}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
