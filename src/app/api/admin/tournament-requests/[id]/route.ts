import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError, quotaErrorResponse } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { decideRequest } from "@/server/tournaments/quota";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/tournament-requests/:id `{ approve, reason? }`: a platform admin approves
 * (one more tournament) or rejects (reason required) a pending request. 200 with the request;
 * 400 INVALID_REASON; 403 for a non-admin; 404; 409 REQUEST_DECIDED.
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
    const decided = await decideRequest(auth.user, (await params).id, approve, reason as string);
    return NextResponse.json(decided, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    const response = quotaErrorResponse(err) ?? roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
}
