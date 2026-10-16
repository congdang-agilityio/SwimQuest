import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { InvalidCursorError, searchUsers } from "@/server/admin/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users?q=&cursor=: platform admins search users by display name or email
 * (20 per page). The role is re-read from the database; never returns password hashes.
 */
export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const params = new URL(request.url).searchParams;
  const q = params.get("q") ?? undefined;
  const cursor = params.get("cursor") ?? undefined;
  if (q !== undefined && q.trim().length > 100)
    return apiError(400, "VALIDATION_FAILED", { q: "TOO_LONG" });
  try {
    const page = await searchUsers(auth.user, { q, cursor });
    return NextResponse.json(page, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    const response = roleErrorResponse(err);
    if (response) return response;
    // A cursor that is empty, too long or not one we issued.
    if (err instanceof InvalidCursorError || (err instanceof Error && err.name === "ZodError"))
      return apiError(400, "VALIDATION_FAILED", { cursor: "INVALID_CURSOR" });
    throw err;
  }
}
