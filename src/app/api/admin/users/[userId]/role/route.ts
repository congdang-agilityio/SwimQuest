import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { LastAdminError, setPlatformAdmin } from "@/server/admin/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ userId: string }> };

/**
 * PUT /api/admin/users/:userId/role `{ isPlatformAdmin: boolean }`: a platform admin grants or
 * removes the admin role (audited). 200 with the user (no password hash); 409 `LAST_ADMIN`
 * when the last active admin would lose the role.
 */
export async function PUT(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok || typeof json.body !== "object" || json.body === null || Array.isArray(json.body))
    return apiError(400, "INVALID_BODY");
  const { isPlatformAdmin } = json.body as { isPlatformAdmin?: unknown };
  if (typeof isPlatformAdmin !== "boolean")
    return apiError(400, "VALIDATION_FAILED", { isPlatformAdmin: "BOOLEAN_REQUIRED" });

  try {
    const user = await setPlatformAdmin(auth.user, (await params).userId, isPlatformAdmin);
    return NextResponse.json(user, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof LastAdminError) return apiError(err.status, err.code);
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
}
