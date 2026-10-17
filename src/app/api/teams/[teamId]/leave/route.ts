import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin } from "@/server/http/request";
import { NotAMemberError } from "@/server/teams/captain";
import { leaveTeam, SeasonStartedError } from "@/server/teams/leave-switch";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ teamId: string }> };

/**
 * POST /api/teams/:teamId/leave: the signed-in member leaves the team before the season
 * starts (200 `{ captainCleared }`). A season already started is 409; not a member is 403.
 */
export async function POST(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  try {
    const { captainCleared } = await leaveTeam(auth.user.id, (await params).teamId);
    return NextResponse.json({ captainCleared }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof NotAMemberError) return apiError(403, err.code);
    if (err instanceof SeasonStartedError) return apiError(err.status, err.code);
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
}
