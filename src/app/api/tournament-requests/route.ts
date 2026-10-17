import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError, quotaErrorResponse } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { getQuota, requestMore } from "@/server/tournaments/quota";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store" };

/** GET /api/tournament-requests: the signed-in user's quota `{ used, allowed, request }`. */
export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  return NextResponse.json(await getQuota(auth.user.id), { headers: noStore });
}

/**
 * POST /api/tournament-requests `{ reason }`: asks for one more tournament. 201 with the
 * request; 400 INVALID_REASON; 409 QUOTA_NOT_REACHED (below the limit) or REQUEST_PENDING.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok || typeof json.body !== "object" || json.body === null || Array.isArray(json.body))
    return apiError(400, "INVALID_BODY");
  try {
    const created = await requestMore(
      auth.user.id,
      (json.body as { reason?: string }).reason ?? "",
    );
    return NextResponse.json(created, { status: 201, headers: noStore });
  } catch (err) {
    const response = quotaErrorResponse(err) ?? roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
}
