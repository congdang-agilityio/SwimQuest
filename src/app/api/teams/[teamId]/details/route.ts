import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { updateTeamDetails } from "@/server/teams/team-details";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ teamId: string }> };

/**
 * PATCH /api/teams/:teamId/details: the captain or the organizer edits the name, emblem and
 * description (200 `{ team }`). The member limit is not editable here (400).
 */
export async function PATCH(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok || typeof json.body !== "object" || json.body === null || Array.isArray(json.body))
    return apiError(400, "INVALID_BODY");
  if ("memberLimit" in json.body)
    return apiError(400, "VALIDATION_FAILED", { memberLimit: "NOT_EDITABLE" });

  let result;
  try {
    result = await updateTeamDetails(auth.user.id, (await params).teamId, json.body);
  } catch (err) {
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
  if (!result.ok) return apiError(400, "VALIDATION_FAILED", result.errors);
  return NextResponse.json({ team: result.team }, { headers: { "cache-control": "no-store" } });
}
