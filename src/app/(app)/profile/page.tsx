import { headers } from "next/headers";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { LogoutButton } from "@/components/auth/logout-button";
import { NavIcon } from "@/components/nav/nav-icon";
import { Avatar, Card, ScreenHeader } from "@/components/ui";
import { mockupMemberAvatar } from "@/lib/art/mockup-avatars";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";
import { getPlayerStats } from "@/server/profile/stats";
import styles from "./profile.module.css";

export default async function ProfilePage() {
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/profile");
  const [t, home, format, stats] = await Promise.all([
    getTranslations("nav"),
    getTranslations("home"),
    getFormatter(),
    getPlayerStats(user.id),
  ]);
  const km = format.number(stats.verifiedDistanceM / 1000, { maximumFractionDigits: 1 });
  return (
    <main className={styles.profile}>
      <div className={styles.headerBand}>
        <ScreenHeader title={t("profile.title")} />
      </div>

      <Card tone="dark" as="section" className={styles.hero} aria-label={user.displayName}>
        <Avatar name={user.displayName} src={mockupMemberAvatar(user.id)} size={72} decorative />
        <span className={styles.name}>{user.displayName}</span>
      </Card>

      <Card as="section" className={styles.stats} aria-label={home("stats.label")}>
        <dl className={styles.statList}>
          <div className={styles.stat}>
            <dt>{home("stats.distance")}</dt>
            <dd>
              <span className={styles.statValue}>{km}</span>{" "}
              <span className={styles.statUnit}>{home("stats.km")}</span>
            </dd>
          </div>
          <div className={styles.stat}>
            <dt>{home("stats.badges")}</dt>
            <dd>
              <span className={styles.statValue}>{format.number(stats.badges)}</span>
            </dd>
          </div>
        </dl>
      </Card>

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
      </Card>

      <div className={styles.logout}>
        <LogoutButton block />
      </div>
    </main>
  );
}
