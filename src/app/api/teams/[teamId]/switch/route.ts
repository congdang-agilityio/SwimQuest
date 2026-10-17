import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { NotAMemberError } from "@/server/teams/captain";
import {
  MembershipConflictError,
  SeasonStartedError,
  switchTeam,
} from "@/server/teams/leave-switch";
import { InvalidMoveError, TeamFullError } from "@/server/teams/move-player";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ teamId: string }> };

/**
 * POST /api/teams/:teamId/switch { toTeamId }: the signed-in member moves to another team of
 * the tournament with room, before the season starts (200). SEASON_STARTED, TEAM_FULL and
 * ALREADY_MEMBER are 409; not a member is 403; the same team is 422.
 */
export async function POST(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok || typeof json.body !== "object" || json.body === null || Array.isArray(json.body))
    return apiError(400, "INVALID_BODY");
  const { toTeamId } = json.body as { toTeamId?: unknown };
  if (typeof toTeamId !== "string" || toTeamId.length === 0)
    return apiError(400, "VALIDATION_FAILED", { toTeamId: "TEAM_REQUIRED" });

  try {
    const result = await switchTeam(auth.user.id, (await params).teamId, toTeamId);
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof NotAMemberError) return apiError(403, err.code);
    if (
      err instanceof SeasonStartedError ||
      err instanceof TeamFullError ||
      err instanceof MembershipConflictError ||
      err instanceof InvalidMoveError
    )
      return apiError(err.status, err.code);
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
}
