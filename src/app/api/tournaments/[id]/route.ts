import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { updateDetails } from "@/server/tournaments/update-details";
import { updateRoute } from "@/server/tournaments/update-route";

export const dynamic = "force-dynamic";

const DETAIL_FIELDS = ["name", "description", "seasonStart", "seasonEnd"];

/**
 * PATCH /api/tournaments/:id. A body naming `name`, `description`, `seasonStart` or `seasonEnd` is a
 * details edit (organizer or admin; 409 SEASON_LOCKED / SEASON_ENDED / ARCHIVED / CONFLICT, 400
 * with fields). Otherwise the organizer changes `routeId` and/or `routeDistanceKm` before the
 * season starts (409 ROUTE_LOCKED from then on). Any other field is rejected with 400.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok) return apiError(400, "INVALID_BODY");

  const body = json.body;
  const isDetails =
    typeof body === "object" &&
    body !== null &&
    !Array.isArray(body) &&
    Object.keys(body).some((key) => DETAIL_FIELDS.includes(key));
  const tournamentId = (await params).id;

  if (isDetails) {
    let details;
    try {
      details = await updateDetails(auth.user, tournamentId, body, new Date());
    } catch (err) {
      const response = roleErrorResponse(err);
      if (response) return response;
      throw err;
    }
    if (!details.ok && details.reason !== "INVALID") return apiError(409, details.reason);
    if (!details.ok) return apiError(400, "VALIDATION_FAILED", details.errors);
    const { id, name, description, seasonStartAt, seasonEndAt, startChoiceDeadlineAt } =
      details.tournament;
    return NextResponse.json(
      {
        tournament: {
          id,
          name,
          description,
          seasonStart: seasonStartAt.toISOString(),
          seasonEnd: seasonEndAt.toISOString(),
          startChoiceDeadlineAt: startChoiceDeadlineAt?.toISOString() ?? null,
        },
      },
      { status: 200, headers: { "cache-control": "no-store" } },
    );
  }

  let result;
  try {
    result = await updateRoute(auth.user.id, tournamentId, body, new Date());
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
