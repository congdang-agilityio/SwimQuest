import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin } from "@/server/http/request";
import { NotAMemberError } from "@/server/teams/captain";
import { removeMember } from "@/server/teams/remove-member";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ teamId: string; userId: string }> };

/**
 * DELETE /api/teams/:teamId/members/:userId: the captain or organizer removes a member
 * (200 `{ afterStart }`; true when the player also left the tournament).
 */
export async function DELETE(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const { teamId, userId } = await params;

  try {
    const { endReason } = await removeMember(auth.user.id, teamId, userId);
    return NextResponse.json(
      { afterStart: endReason === "REMOVED_AFTER_START" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof NotAMemberError) return apiError(err.status, err.code);
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
}
