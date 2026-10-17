import { headers } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { NotificationList } from "@/components/notifications/notification-list";
import type { NotificationView } from "@/components/notifications/notification-item";
import { StateCard } from "@/components/states/state-card";
import { ScreenHeader } from "@/components/ui";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";
import { listNotifications } from "@/server/notifications/inbox";
import styles from "@/components/notifications/notifications.module.css";

export default async function NotificationsPage() {
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/notifications");
  const [t, common, page] = await Promise.all([
    getTranslations("notifications"),
    getTranslations("common"),
    listNotifications(user.id),
  ]);
  const items: NotificationView[] = page.items.map((n) => ({
    id: n.id,
    type: n.type,
    params: (n.params ?? {}) as Record<string, unknown>,
    link: n.link,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  }));
  return (
    <main className={styles.page}>
      <div className={styles.headerBand}>
        <ScreenHeader
          title={t("title")}
          backHref="/"
          backLabel={common("back")}
          action={
            <Link
              href="/profile/notifications"
              className={styles.settingsLink}
              aria-label={t("settings.title")}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7.6 7.6 0 0 1-2 1.2L14.8 21h-4l-.3-2.4a7.6 7.6 0 0 1-2-1.2l-1.9.7-2-3.4 1.6-1.2a7.6 7.6 0 0 1 0-2.4L4.6 9.9l2-3.4 1.9.7a7.6 7.6 0 0 1 2-1.2L10.8 3h4l.3 2.4a7.6 7.6 0 0 1 2 1.2l1.9-.7 2 3.4-1.6 1.2a7.6 7.6 0 0 1 0 2.4Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          }
        />
      </div>
      {items.length === 0 ? (
        <StateCard art="items/message-bottle" titleId="notifications-empty" title={t("empty")} />
      ) : (
        <NotificationList initialItems={items} initialCursor={page.nextCursor} />
      )}
    </main>
  );
}
