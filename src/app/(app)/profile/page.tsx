import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LanguageSwitch } from "@/components/i18n/language-switch";
import { LogoutButton } from "@/components/auth/logout-button";
import { NavIcon } from "@/components/nav/nav-icon";
import { BadgesSection } from "@/components/profile/badges-section";
import { InstallApp } from "@/components/pwa/install-app";
import { ProfileSection } from "@/components/profile/profile-section";
import { StatsSection } from "@/components/profile/stats-section";
import { Card, ScreenHeader } from "@/components/ui";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { listUserBadges } from "@/server/badges/list";
import { getMyProfile } from "@/server/profile/my-profile";
import { getLevels } from "@/server/xp/level";
import { getPlayerStats } from "@/server/profile/stats";
import styles from "./profile.module.css";

export default async function ProfilePage() {
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/profile");
  const [t, tc, stats, profile, badges, levels] = await Promise.all([
    getTranslations("nav"),
    getTranslations("common"),
    getPlayerStats(user.id),
    getMyProfile(user.id),
    listUserBadges(user.id),
    getLevels([user.id]),
  ]);
  // The account vanished after the session check: sign in again. Never notFound() here, because
  // loading.tsx streams a 200 first and a 404 could no longer be sent.
  if (!profile) redirect("/login?next=/profile");
  const teams = await db.team.findMany({
    where: { id: { in: stats.currentProgress.map((p) => p.teamId) } },
    select: { id: true, name: true },
  });
  const teamNames = Object.fromEntries(teams.map((team) => [team.id, team.name]));
  return (
    <main className={styles.profile}>
      <div className={styles.headerBand}>
        <ScreenHeader title={t("profile.title")} />
      </div>

      <ProfileSection
        profile={profile}
        level={levels.get(user.id) ?? { xp: 0, level: 1, xpToNext: 25 }}
      />

      <StatsSection stats={stats} teamNames={teamNames} />

      <BadgesSection badges={badges} />

      <Card className={styles.rows}>
        <Link href="/swims" className={styles.row}>
          <span className={styles.rowIcon}>
            <NavIcon name="voyage" />
          </span>
          <span className={styles.rowLabel}>{t("profile.mySwims")}</span>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M9 5l7 7-7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <Link href="/safety" className={styles.row}>
          <span className={styles.rowIcon}>
            <NavIcon name="home" />
          </span>
          <span className={styles.rowLabel}>{t("profile.safety")}</span>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M9 5l7 7-7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <Link href="/profile/notifications" className={styles.row}>
          <span className={styles.rowIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15l1.5-2ZM10 20.5a2 2 0 0 0 4 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className={styles.rowLabel}>{t("profile.notifications")}</span>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M9 5l7 7-7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <Link href="/profile/security" className={styles.row}>
          <span className={styles.rowIcon}>
            <NavIcon name="profile" />
          </span>
          <span className={styles.rowLabel}>{t("profile.security")}</span>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M9 5l7 7-7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <Link href="/profile/privacy" className={styles.row}>
          <span className={styles.rowIcon}>
            <NavIcon name="profile" />
          </span>
          <span className={styles.rowLabel}>{t("profile.privacy")}</span>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M9 5l7 7-7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </Card>

      <InstallApp />

      <div className={styles.language}>
        <span>{tc("language.label")}</span>
        <LanguageSwitch />
      </div>

      <div className={styles.logout}>
        <LogoutButton block />
      </div>
    </main>
  );
}
