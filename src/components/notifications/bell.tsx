import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { unreadCount } from "@/server/notifications/inbox";
import styles from "./notifications.module.css";

/** Round bell button for the top bar: links to /notifications and shows the unread count. */
export async function NotificationBell({ userId }: { userId: string }) {
  const [t, count] = await Promise.all([getTranslations("notifications"), unreadCount(userId)]);
  return (
    <Link
      href="/notifications"
      className={styles.bell}
      aria-label={count > 0 ? t("bellUnread", { count }) : t("bell")}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15l1.5-2ZM10 20.5a2 2 0 0 0 4 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {count > 0 && (
        <span className={styles.count} aria-hidden="true">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
