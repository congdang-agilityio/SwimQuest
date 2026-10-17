import { NextResponse } from "next/server";
import { StartNotLockedError, correctStart } from "@/server/admin/start-correction";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { ReasonRequiredError } from "@/server/review/decide";
import { InvalidStartError } from "@/server/starts/choose-start";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ teamId: string }> };

/**
 * PUT /api/admin/teams/:teamId/start `{ slug, reason }`: a platform admin corrects a team's
 * locked start (200 `{ destination, changed }`). 400 `INVALID_START` or `REASON_REQUIRED`, 403
 * for a non-admin, 404, 409 `START_NOT_LOCKED` or `ARCHIVED`.
 */
export async function PUT(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok || typeof json.body !== "object" || json.body === null || Array.isArray(json.body))
    return apiError(400, "INVALID_BODY");

  try {
    const { slug, reason } = json.body as { slug?: unknown; reason?: unknown };
    const result = await correctStart(auth.user, (await params).teamId, slug, reason);
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof InvalidStartError || err instanceof ReasonRequiredError)
      return apiError(400, err.code);
    if (err instanceof StartNotLockedError) return apiError(err.status, err.code);
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
}
