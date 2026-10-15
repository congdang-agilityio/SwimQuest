import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin } from "@/server/http/request";
import { publishTournament } from "@/server/tournaments/publish";

export const dynamic = "force-dynamic";

/** The public origin, honoring the proxy's forwarded host and protocol. */
function originOf(request: Request): string {
  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
  const proto = request.headers.get("x-forwarded-proto") === "http" ? "http" : "https";
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}

/**
 * POST /api/tournaments/:id/publish: the organizer publishes a draft. 200 with the invite URL
 * (also on a repeat call), 422 PUBLISH_INVALID with `issues[]` when the draft needs fixes.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  let result;
  try {
    result = await publishTournament(auth.user.id, (await params).id);
  } catch (err) {
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
  if (!result.ok) return apiError(422, "PUBLISH_INVALID", undefined, result.issues);

  const inviteUrl = `${originOf(request)}/join/${result.tournament.inviteToken}`;
  return NextResponse.json(
    { status: "PUBLISHED", inviteUrl },
    { headers: { "cache-control": "no-store" } },
  );
}
