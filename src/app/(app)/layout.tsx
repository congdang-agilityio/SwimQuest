import { headers } from "next/headers";
import type { ReactNode } from "react";
import { NotificationBell } from "@/components/notifications/bell";
import { AppNav } from "@/components/nav/app-nav";
import styles from "@/components/nav/app-nav.module.css";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { defaultAvatarSrc, imageSrc } from "@/lib/profile-avatar";
import { requireUser } from "@/server/auth/current-user";
import { getTournamentSwitcher } from "@/server/home/selected-tournament";
import { getAvatarFields } from "@/server/profile/my-avatar";

/** Session checks must run on every request; protected pages are never statically cached. */
export const dynamic = "force-dynamic";

/**
 * Every signed-in page lives under this layout. Middleware only checks that a cookie exists;
 * here the session is validated in the database, so an expired or deleted session lands on login.
 * Pages render on a light rounded sheet over the deep-blue ocean background (mockup shell).
 * A user with a temporary password is redirected to the new-password page by `requireUser` and
 * sees it without the navigation, so nothing else is reachable until the password is changed.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const nextPath = (await headers()).get(NEXT_PATH_HEADER) ?? "/";
  const user = await requireUser(nextPath);
  if (user.mustChangePassword) {
    return (
      <div className={styles.content} data-surface="light">
        {children}
      </div>
    );
  }
  const [switcher, avatar] = await Promise.all([
    getTournamentSwitcher(user.id),
    getAvatarFields(user.id),
  ]);
  return (
    <>
      <AppNav
        displayName={user.displayName}
        // The pill shows the real picture only; without one it keeps the initials.
        avatarSrc={imageSrc(avatar.avatarImageId) ?? defaultAvatarSrc(avatar.avatarDefaultKey)}
        isPlatformAdmin={user.isPlatformAdmin}
        switcher={switcher}
        bell={<NotificationBell userId={user.id} />}
      />
      <div className={styles.content} data-surface="light">
        {children}
      </div>
    </>
  );
}
