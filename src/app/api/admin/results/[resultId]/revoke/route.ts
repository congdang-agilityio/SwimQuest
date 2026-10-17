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
 * POST /api/admin/results/:resultId/revoke `{ reason }`: a platform admin revokes one verified
 * swim result in any tournament (S-72 AC 4), reversed exactly as the reviewer path (S-46) and
 * audited with the admin as actor. 200 `{ resultId, status: "REVOKED" }`; 400 REASON_REQUIRED;
 * 403 for a non-admin; 404; 409 NOT_REVOKABLE or ARCHIVED.
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
    // The service validates the reason after the role check, so a non-admin gets 403.
    const reasonText = typeof reason === "string" ? reason : "";
    const result = await revokeResult(auth.user.id, (await params).resultId, reasonText, {
      asAdmin: true,
    });
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof ReasonRequiredError || err instanceof NotRevokableError)
      return apiError(err.status, err.code);
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
}
