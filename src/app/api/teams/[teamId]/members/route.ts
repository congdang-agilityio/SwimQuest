import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { NotAMemberError } from "@/server/teams/captain";
import { TeamFullError } from "@/server/teams/move-player";
import { addPlayerToTeam, AlreadyMemberError } from "@/server/teams/add-player";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ teamId: string }> };

/** POST /api/teams/:teamId/members { userId }: the organizer adds a teamless player (201). */
export async function POST(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok || typeof json.body !== "object" || json.body === null || Array.isArray(json.body))
    return apiError(400, "INVALID_BODY");
  const { userId } = json.body as { userId?: unknown };
  if (typeof userId !== "string" || userId.length === 0)
    return apiError(400, "VALIDATION_FAILED", { userId: "PLAYER_REQUIRED" });

  try {
    const { teamId } = await params;
    const result = await addPlayerToTeam(auth.user.id, teamId, userId);
    return NextResponse.json(result, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (
      err instanceof TeamFullError ||
      err instanceof AlreadyMemberError ||
      err instanceof NotAMemberError
    )
      return apiError(err.status, err.code);
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
}
