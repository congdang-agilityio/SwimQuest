import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { ReasonRequiredError } from "@/server/review/decide";
import { NotRevokableError, revokeResult } from "@/server/review/revoke";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ resultId: string }> };

/**
 * POST /api/review/results/:resultId/revoke `{ reason }`: a reviewer of the result's tournament
 * revokes one verified swim (S-46). 200 `{ resultId, status: "REVOKED" }`; 400 REASON_REQUIRED
 * for a missing or invalid 1-300 character reason; 403 for a non-reviewer; 404 for an unknown
 * result; 409 NOT_REVOKABLE when the result is not VERIFIED.
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
    // The service validates the reason after the role check, so a non-reviewer gets 403.
    const reasonText = typeof reason === "string" ? reason : "";
    const result = await revokeResult(auth.user.id, (await params).resultId, reasonText);
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof ReasonRequiredError || err instanceof NotRevokableError)
      return apiError(err.status, err.code);
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
}
