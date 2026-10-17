import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin } from "@/server/http/request";
import { archiveTournament } from "@/server/tournaments/archive";

export const dynamic = "force-dynamic";

/**
 * POST /api/tournaments/:id/archive: the organizer archives a completed tournament. 200 with
 * `{ status: "ARCHIVED", archivedAt }` (also on a repeat call), 409 NOT_COMPLETED otherwise.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  let result;
  try {
    result = await archiveTournament(auth.user.id, (await params).id, new Date());
  } catch (err) {
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
  if (!result.ok) return apiError(409, "NOT_COMPLETED");
  return NextResponse.json(
    { status: "ARCHIVED", archivedAt: result.archivedAt.toISOString() },
    { headers: { "cache-control": "no-store" } },
  );
}
