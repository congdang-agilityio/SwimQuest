import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { getPushPreferences, setPushPreferences } from "@/server/notifications/preferences";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

/** GET /api/me/notification-preferences: `{ push: { INVITATIONS: true, ... } }`, all on by default. */
export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const push = await getPushPreferences(auth.user.id);
  if (!push) return apiError(404, "NOT_FOUND");
  return NextResponse.json({ push }, { headers: NO_STORE });
}

/** PUT /api/me/notification-preferences `{ push: { MILESTONES: false } }`: partial update. */
export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok) return apiError(400, "INVALID_BODY");
  const patch = (json.body as { push?: unknown } | null)?.push;
  const result = await setPushPreferences(auth.user.id, patch);
  if (!result.ok) {
    return result.error === "NOT_FOUND"
      ? apiError(404, "NOT_FOUND")
      : apiError(400, "VALIDATION_FAILED");
  }
  return NextResponse.json({ push: result.push }, { headers: NO_STORE });
}
