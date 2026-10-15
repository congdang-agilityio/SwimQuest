import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { deleteTeam, TeamRuleError, updateTeam } from "@/server/teams/manage";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ teamId: string }> };

/** Maps the role and team-rule errors to responses; anything else is rethrown. */
function failure(err: unknown) {
  if (err instanceof TeamRuleError) return apiError(err.status, err.code);
  const response = roleErrorResponse(err);
  if (response) return response;
  throw err;
}

/** PATCH /api/teams/:teamId: the organizer edits a team (200 `{ team }`). */
export async function PATCH(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok) return apiError(400, "INVALID_BODY");

  let result;
  try {
    result = await updateTeam(auth.user.id, (await params).teamId, json.body);
  } catch (err) {
    return failure(err);
  }
  if (!result.ok) return apiError(400, "VALIDATION_FAILED", result.errors);
  return NextResponse.json({ team: result.team }, { headers: { "cache-control": "no-store" } });
}

/** DELETE /api/teams/:teamId: removes an empty team of a draft tournament (204). */
export async function DELETE(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  try {
    await deleteTeam(auth.user.id, (await params).teamId);
  } catch (err) {
    return failure(err);
  }
  return new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } });
}
