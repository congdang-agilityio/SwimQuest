import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { handOverCaptaincy, NotAMemberError } from "@/server/teams/captain";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ teamId: string }> };

/**
 * POST /api/teams/:teamId/handover: the captain makes another active member captain
 * (200 `{ captainUserId }`). A non-captain is 403; a target who is not an active member is 422.
 */
export async function POST(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok || typeof json.body !== "object" || json.body === null || Array.isArray(json.body))
    return apiError(400, "INVALID_BODY");
  const { userId } = json.body as { userId?: unknown };
  if (typeof userId !== "string" || userId.length === 0)
    return apiError(400, "VALIDATION_FAILED", { userId: "USER_REQUIRED" });

  try {
    await handOverCaptaincy(auth.user.id, (await params).teamId, userId);
    return NextResponse.json(
      { captainUserId: userId },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof NotAMemberError) return apiError(err.status, err.code);
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
}
