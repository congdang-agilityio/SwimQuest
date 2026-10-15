import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { chooseStart, InvalidStartError, StartLockedError } from "@/server/starts/choose-start";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ teamId: string }> };

/**
 * PUT /api/teams/:teamId/start: the captain chooses the start (200 `{ destination, changed }`).
 * After the start-choice deadline a different start is 409 `START_LOCKED` with
 * `issues: [{ lockedAt }]`; the same start again is still 200 with `changed: false`.
 */
export async function PUT(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok || typeof json.body !== "object" || json.body === null || Array.isArray(json.body))
    return apiError(400, "INVALID_BODY");

  try {
    const { destination } = json.body as { destination?: unknown };
    const { changed, start } = await chooseStart(auth.user.id, (await params).teamId, destination);
    return NextResponse.json(
      { destination: start.slug, changed },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof InvalidStartError) return apiError(err.status, err.code);
    if (err instanceof StartLockedError)
      return apiError(err.status, err.code, undefined, [{ lockedAt: err.lockedAt.toISOString() }]);
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
}
