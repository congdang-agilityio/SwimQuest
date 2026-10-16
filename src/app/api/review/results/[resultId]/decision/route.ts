import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { AlreadyDecidedError, ReasonRequiredError, decideFlagged } from "@/server/review/decide";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ resultId: string }> };

/**
 * POST /api/review/results/:resultId/decision `{ approve, reason? }`: a reviewer of the result's
 * tournament approves or rejects one flagged swim (S-43). 200 `{ resultId, status }`;
 * 400 REASON_REQUIRED for a reject without a 1-300 character reason; 403 for a non-reviewer;
 * 404 for an unknown result; 409 ALREADY_DECIDED when it is no longer flagged.
 */
export async function POST(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok || typeof json.body !== "object" || json.body === null || Array.isArray(json.body))
    return apiError(400, "INVALID_BODY");
  const { approve, reason } = json.body as { approve?: unknown; reason?: unknown };
  if (typeof approve !== "boolean")
    return apiError(400, "VALIDATION_FAILED", { approve: "APPROVE_REQUIRED" });

  try {
    // The service validates the reason (after the role check, so a non-reviewer gets 403).
    const decision = { approve, reason: reason as string | undefined };
    const result = await decideFlagged(auth.user.id, (await params).resultId, decision);
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof ReasonRequiredError || err instanceof AlreadyDecidedError)
      return apiError(err.status, err.code);
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
}
