import { headers } from "next/headers";
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
        <ScreenHeader title={t("title")} backHref="/" backLabel={common("back")} />
      </div>
      {items.length === 0 ? (
        <StateCard art="items/message-bottle" titleId="notifications-empty" title={t("empty")} />
      ) : (
        <NotificationList initialItems={items} initialCursor={page.nextCursor} />
      )}
    </main>
  );
}
