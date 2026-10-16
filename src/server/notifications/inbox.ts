import { db } from "../db";

export const PAGE_SIZE = 20;

/** A page of the player's notifications, newest first; pass `nextCursor` to get the next page. */
export async function listNotifications(userId: string, cursor?: string | null) {
  const rows = await db.notification.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const items = rows.slice(0, PAGE_SIZE);
  return { items, nextCursor: rows.length > PAGE_SIZE ? items[items.length - 1].id : null };
}

export function unreadCount(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } });
}

/** Marks every unread notification of the player as read; returns how many changed. */
export async function markAllRead(userId: string): Promise<number> {
  const { count } = await db.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return count;
}
