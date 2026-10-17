import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import {
  AlreadyHelperError,
  NotAHelperError,
  NotAPlayerError,
  appointHelper,
  listHelpers,
  removeHelper,
} from "@/server/review/helpers";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const NO_STORE = { "cache-control": "no-store" };

function failure(err: unknown) {
  if (
    err instanceof NotAPlayerError ||
    err instanceof AlreadyHelperError ||
    err instanceof NotAHelperError
  )
    return apiError(err.status, err.code);
  const response = roleErrorResponse(err);
  if (response) return response;
  throw err;
}

async function readUserId(request: Request): Promise<string | null> {
  const json = await readJson(request);
  if (!json.ok || typeof json.body !== "object" || json.body === null || Array.isArray(json.body))
    return null;
  const { userId } = json.body as { userId?: unknown };
  return typeof userId === "string" ? userId : "";
}

/** GET /api/tournaments/:id/review-helpers: the organizer lists the active helpers. */
export async function GET(_request: Request, { params }: Ctx) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  try {
    const helpers = await listHelpers(auth.user.id, (await params).id);
    return NextResponse.json({ helpers }, { headers: NO_STORE });
  } catch (err) {
    return failure(err);
  }
}

/**
 * POST /api/tournaments/:id/review-helpers `{ userId }`: the organizer appoints a player of the
 * tournament as review helper. 201 `{ helperId }`; 400 NOT_A_PLAYER; 403/404 by role;
 * 409 ALREADY_HELPER.
 */
export async function POST(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const userId = await readUserId(request);
  if (userId === null) return apiError(400, "INVALID_BODY");
  try {
    const result = await appointHelper(auth.user.id, (await params).id, userId);
    return NextResponse.json(result, { status: 201, headers: NO_STORE });
  } catch (err) {
    return failure(err);
  }
}

/**
 * DELETE /api/tournaments/:id/review-helpers `{ userId }`: the organizer removes a helper.
 * 200 `{ removed: true }`; 403/404 by role; 404 NOT_A_HELPER.
 */
export async function DELETE(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const userId = await readUserId(request);
  if (userId === null) return apiError(400, "INVALID_BODY");
  try {
    await removeHelper(auth.user.id, (await params).id, userId);
    return NextResponse.json({ removed: true }, { headers: NO_STORE });
  } catch (err) {
    return failure(err);
  }
}
