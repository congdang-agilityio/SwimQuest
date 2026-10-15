import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { updateRoute } from "@/server/tournaments/update-route";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/tournaments/:id: the organizer changes `routeId` and/or `routeDistanceKm` before the
 * season starts (409 ROUTE_LOCKED from then on). Any other field is rejected with 400.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok) return apiError(400, "INVALID_BODY");

  let result;
  try {
    result = await updateRoute(auth.user.id, (await params).id, json.body, new Date());
  } catch (err) {
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
  if (!result.ok && result.reason === "ROUTE_LOCKED") return apiError(409, "ROUTE_LOCKED");
  if (!result.ok) return apiError(400, "VALIDATION_FAILED", result.errors);

  const { id, routeId, routeDistanceM } = result.tournament;
  return NextResponse.json(
    { tournament: { id, routeId, routeDistanceKm: routeDistanceM / 1000 } },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
