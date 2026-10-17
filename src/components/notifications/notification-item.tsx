import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import styles from "./notifications.module.css";

export type NotificationView = {
  id: string;
  type: string;
  params: Record<string, unknown>;
  link: string;
  readAt: string | null;
  createdAt: string;
};

const KNOWN = new Set([
  "swim.verified",
  "swim.flagged",
  "swim.rejected",
  "swim.revoked",
  "swim.ruleMissed",
  "swim.disputeDecided",
  "team.invited",
  "team.joined",
  "team.moved",
  "team.removed",
  "team.captainSet",
  "team.startChosen",
  "team.startAssigned",
  "team.startLocked",
  "milestone.destinationPassed",
  "milestone.finished",
  "milestone.finishLost",
  "milestone.badgeEarned",
  "milestone.levelUp",
]);

/** One notification: text from messages by type and params, a "New" mark when unread, links to its page. */
export function NotificationItem({ item, unread }: { item: NotificationView; unread: boolean }) {
  const t = useTranslations("notifications");
  const tr = useTranslations("routes.route01");
  const format = useFormatter();
  const slug = typeof item.params.destination === "string" ? item.params.destination : "";
  const text = KNOWN.has(item.type)
    ? t(
        `types.${item.type}` as never,
        {
          destination: slug && tr.has(slug as never) ? tr(slug as never) : "",
          level: Number(item.params.level ?? 0),
        } as never,
      )
    : t("unknown");
  const href = item.link.startsWith("/") && !item.link.startsWith("//") ? item.link : "/";
  return (
    <li>
      <Link href={href} className={styles.item} data-unread={unread || undefined}>
        <span className={styles.itemText}>
          {unread && <span className={styles.newMark}>{t("unread")}</span>}
          {text}
        </span>
        <time className={styles.itemTime} dateTime={item.createdAt}>
          {format.dateTime(new Date(item.createdAt), {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Ho_Chi_Minh",
          })}
        </time>
      </Link>
    </li>
  );
}
