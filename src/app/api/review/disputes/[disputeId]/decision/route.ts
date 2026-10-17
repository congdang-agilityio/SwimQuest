import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { AlreadyDecidedError, ReasonRequiredError } from "@/server/review/decide";
import { decideDispute } from "@/server/review/disputes";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ disputeId: string }> };

/**
 * POST /api/review/disputes/:disputeId/decision `{ accept, reason }`: a reviewer of the result's
 * tournament accepts or rejects one open dispute (S-44). 200 `{ disputeId, resultId, status }`;
 * 400 REASON_REQUIRED without a 1-300 character reason; 403 for a non-reviewer; 404 for an
 * unknown dispute; 409 ALREADY_DECIDED when it is no longer open.
 */
export async function POST(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok || typeof json.body !== "object" || json.body === null || Array.isArray(json.body))
    return apiError(400, "INVALID_BODY");
  const { accept, reason } = json.body as { accept?: unknown; reason?: unknown };
  if (typeof accept !== "boolean")
    return apiError(400, "VALIDATION_FAILED", { accept: "ACCEPT_REQUIRED" });

  try {
    // The service validates the reason (after the role check, so a non-reviewer gets 403).
    const decision = { accept, reason: reason as string | undefined };
    const result = await decideDispute(auth.user.id, (await params).disputeId, decision);
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof ReasonRequiredError || err instanceof AlreadyDecidedError)
      return apiError(err.status, err.code);
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
}
