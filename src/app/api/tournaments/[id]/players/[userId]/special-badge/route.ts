import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import {
  AlreadyAwardedError,
  giveSpecialBadge,
  InvalidSpecialReasonError,
} from "@/server/badges/special-badge";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { NotAPlayerError } from "@/server/review/helpers";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; userId: string }> };

/**
 * POST /api/tournaments/:id/players/:userId/special-badge `{ reason }`: the organizer gives the
 * player the Special badge. 201 `{ badgeId }`; 400 VALIDATION_FAILED (reason 1-200 characters)
 * or NOT_A_PLAYER; 403/404 by role; 409 ARCHIVED or ALREADY_AWARDED.
 */
export async function POST(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok || typeof json.body !== "object" || json.body === null || Array.isArray(json.body))
    return apiError(400, "INVALID_BODY");
  const { reason } = json.body as { reason?: unknown };

  try {
    const { id, userId } = await params;
    const result = await giveSpecialBadge(auth.user.id, id, userId, reason);
    return NextResponse.json(result, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof InvalidSpecialReasonError) return apiError(err.status, err.code, err.fields);
    if (err instanceof NotAPlayerError || err instanceof AlreadyAwardedError)
      return apiError(err.status, err.code);
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
}
