import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import {
  canSelectTournament,
  SELECTED_TOURNAMENT_COOKIE,
  SELECTED_TOURNAMENT_MAX_AGE_S,
} from "@/server/home/selected-tournament";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PUT /api/me/selected-tournament `{ tournamentId }`: remember the choice for a year. 404 if not an active member. */
export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok) return apiError(400, "INVALID_BODY");
  const tournamentId = (json.body as { tournamentId?: unknown } | null)?.tournamentId;
  if (typeof tournamentId !== "string" || !tournamentId) return apiError(400, "VALIDATION_FAILED");
  if (!(await canSelectTournament(auth.user.id, tournamentId))) return apiError(404, "NOT_FOUND");
  const response = NextResponse.json(
    { tournamentId },
    { headers: { "cache-control": "no-store" } },
  );
  response.cookies.set(SELECTED_TOURNAMENT_COOKIE, tournamentId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SELECTED_TOURNAMENT_MAX_AGE_S,
  });
  return response;
}
