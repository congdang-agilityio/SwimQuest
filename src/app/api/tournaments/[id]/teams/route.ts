import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { createTeam } from "@/server/teams/manage";

export const dynamic = "force-dynamic";

/** POST /api/tournaments/:id/teams: the organizer creates a team (201 `{ team }`). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok) return apiError(400, "INVALID_BODY");

  let result;
  try {
    result = await createTeam(auth.user.id, (await params).id, json.body);
  } catch (err) {
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
  if (!result.ok) return apiError(400, "VALIDATION_FAILED", result.errors);
  return NextResponse.json(
    { team: result.team },
    { status: 201, headers: { "cache-control": "no-store" } },
  );
}
