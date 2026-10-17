import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin } from "@/server/http/request";
import { markAllRead } from "@/server/notifications/inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/me/notifications/read: marks all of the signed-in player's notifications read. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const marked = await markAllRead(auth.user.id);
  return NextResponse.json({ ok: true, marked }, { headers: { "cache-control": "no-store" } });
}
