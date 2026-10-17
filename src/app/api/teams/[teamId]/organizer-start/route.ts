import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { InvalidStartError, StartLockedError } from "@/server/starts/choose-start";
import { organizerSetStart } from "@/server/starts/organizer-start";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ teamId: string }> };

/**
 * PUT /api/teams/:teamId/organizer-start { slug }: the organizer sets or replaces the start
 * before the lock (200 `{ destination, changed }`). 400 `INVALID_START`, 403 for a
 * non-organizer, 409 `START_LOCKED` with `issues: [{ lockedAt }]`.
 */
export async function PUT(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok || typeof json.body !== "object" || json.body === null || Array.isArray(json.body))
    return apiError(400, "INVALID_BODY");

  try {
    const { slug } = json.body as { slug?: unknown };
    const { changed, start } = await organizerSetStart(auth.user.id, (await params).teamId, slug);
    return NextResponse.json(
      { destination: start.slug, changed },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof InvalidStartError) return apiError(400, err.code);
    if (err instanceof StartLockedError)
      return apiError(err.status, err.code, undefined, [{ lockedAt: err.lockedAt.toISOString() }]);
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
}
