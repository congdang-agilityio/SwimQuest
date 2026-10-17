import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin } from "@/server/http/request";
import { resetPassword } from "@/server/admin/reset-password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ userId: string }> };

/**
 * POST /api/admin/users/:userId/password-reset: a platform admin sets a one-time temporary
 * password for a player (S-59 AC 2, AC 5); the player's sessions end and the reset is audited.
 * 200 `{ temporaryPassword }`, sent once with `no-store` and never logged; 403 for a non-admin;
 * 404 for an unknown or deleted user.
 */
export async function POST(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  try {
    const { temporaryPassword } = await resetPassword(auth.user, (await params).userId);
    return NextResponse.json(
      { temporaryPassword },
      { headers: { "cache-control": "no-store", pragma: "no-cache" } },
    );
  } catch (err) {
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
}
