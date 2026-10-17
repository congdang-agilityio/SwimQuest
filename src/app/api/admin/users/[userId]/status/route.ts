import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import {
  CannotSuspendSelfError,
  InvalidAccountStateError,
  ReasonRequiredError,
  reactivateUser,
  suspendUser,
} from "@/server/admin/account-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ userId: string }> };

/**
 * PUT /api/admin/users/:userId/status `{ status: "SUSPENDED" | "ACTIVE", reason }`: a platform
 * admin suspends (sessions end at once) or reactivates an account, audited (S-63 AC 1, AC 4).
 * 200 `{ id, status }`; 400 INVALID_REASON for a missing or too long reason; 403 for a
 * non-admin; 404 for an unknown user; 409 `INVALID_STATE` or `CANNOT_SUSPEND_SELF`.
 */
export async function PUT(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok || typeof json.body !== "object" || json.body === null || Array.isArray(json.body))
    return apiError(400, "INVALID_BODY");
  const { status, reason } = json.body as { status?: unknown; reason?: unknown };
  if (status !== "SUSPENDED" && status !== "ACTIVE")
    return apiError(400, "VALIDATION_FAILED", { status: "INVALID_STATUS" });
  if (typeof reason !== "string") return apiError(400, "INVALID_REASON");

  try {
    const change = status === "SUSPENDED" ? suspendUser : reactivateUser;
    const user = await change(auth.user, (await params).userId, reason);
    return NextResponse.json(user, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof ReasonRequiredError) return apiError(400, "INVALID_REASON");
    if (err instanceof CannotSuspendSelfError || err instanceof InvalidAccountStateError)
      return apiError(err.status, err.code);
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
}
