import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { apiError } from "@/server/http/api-error";
import { listNotifications, unreadCount } from "@/server/notifications/inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/me/notifications?cursor=: a page of the signed-in player's notifications (newest first) and the unread count. */
export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const cursor = new URL(request.url).searchParams.get("cursor");
  if (cursor !== null && (cursor.length === 0 || cursor.length > 64)) {
    return apiError(400, "VALIDATION_FAILED", { cursor: "INVALID_CURSOR" });
  }
  const [page, unread] = await Promise.all([
    listNotifications(auth.user.id, cursor),
    unreadCount(auth.user.id),
  ]);
  return NextResponse.json({ ...page, unreadCount: unread }, { headers: { "cache-control": "no-store" } });
}
