import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { NotAMemberError } from "@/server/teams/captain";
import { InvalidMoveError, movePlayer, TeamFullError } from "@/server/teams/move-player";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ teamId: string; userId: string }> };

/** POST /api/teams/:teamId/members/:userId/move { toTeamId }: the organizer moves a player (200). */
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
    const { teamId, userId } = await params;
    const result = await movePlayer(auth.user.id, userId, teamId, toTeamId);
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (
      err instanceof TeamFullError ||
      err instanceof InvalidMoveError ||
      err instanceof NotAMemberError
    )
      return apiError(err.status, err.code);
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
}
