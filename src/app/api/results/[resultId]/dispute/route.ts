import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { ForbiddenError, roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { AlreadyDecidedError, ReasonRequiredError } from "@/server/review/decide";
import { DisputeOpenError, NotDisputableError, raiseDispute } from "@/server/review/disputes";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ resultId: string }> };

/**
 * POST /api/results/:resultId/dispute `{ reason }`: the owner disputes one REJECTED, DUPLICATE or
 * RULE_MISSED result (S-44). 200 `{ disputeId, resultId }`; 400 REASON_REQUIRED without a 1-300
 * character reason; 404 for an unknown result or one owned by another player (never revealed);
 * 409 DISPUTE_OPEN or NOT_DISPUTABLE.
 */
export async function POST(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok || typeof json.body !== "object" || json.body === null || Array.isArray(json.body))
    return apiError(400, "INVALID_BODY");
  const { reason } = json.body as { reason?: unknown };
  if (typeof reason !== "string" || reason.trim().length === 0 || reason.trim().length > 300)
    return apiError(400, "REASON_REQUIRED");

  try {
    const result = await raiseDispute(auth.user.id, (await params).resultId, reason);
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof ForbiddenError) return apiError(404, "NOT_FOUND");
    if (
      err instanceof DisputeOpenError ||
      err instanceof NotDisputableError ||
      err instanceof ReasonRequiredError ||
      err instanceof AlreadyDecidedError
    )
      return apiError(err.status, err.code);
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
}
