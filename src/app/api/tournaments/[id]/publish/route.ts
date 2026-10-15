import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, publicOrigin } from "@/server/http/request";
import { publishTournament } from "@/server/tournaments/publish";

export const dynamic = "force-dynamic";

/**
 * POST /api/tournaments/:id/publish: the organizer publishes a draft. 200 with the invite URL
 * (also on a repeat call), 422 PUBLISH_INVALID with `issues[]` when the draft needs fixes.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  let origin;
  try {
    origin = publicOrigin(request); // before publishing, so a misconfiguration changes nothing
  } catch (err) {
    console.error(`publish: ${(err as Error).message}`);
    return apiError(500, "INTERNAL_ERROR");
  }

  let result;
  try {
    result = await publishTournament(auth.user.id, (await params).id);
  } catch (err) {
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
  if (!result.ok) return apiError(422, "PUBLISH_INVALID", undefined, result.issues);

  const inviteUrl = `${origin}/join/${result.tournament.inviteToken}`;
  return NextResponse.json(
    { status: "PUBLISHED", inviteUrl },
    { headers: { "cache-control": "no-store" } },
  );
}
