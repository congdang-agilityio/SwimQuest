import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { getMyProfile, updateMyProfile } from "@/server/profile/my-profile";
import { BIO_MAX, DISPLAY_NAME_MAX } from "@/lib/validation/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };
const LIMITS = { displayName: DISPLAY_NAME_MAX, bio: BIO_MAX };

/** GET /api/me/profile: the signed-in player's own profile (never email or password hash). */
export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const profile = await getMyProfile(auth.user.id);
  if (!profile) return apiError(404, "NOT_FOUND");
  return NextResponse.json({ profile, limits: LIMITS }, { headers: NO_STORE });
}

/**
 * PATCH /api/me/profile `{ displayName?, bio?, regionCode?, avatarDefaultKey?, avatarImageId?,
 * coverImageId? }`: partial update. 400 VALIDATION_FAILED with field error codes and `limits`.
 */
export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok) return apiError(400, "INVALID_BODY");
  const result = await updateMyProfile(auth.user.id, json.body);
  if (!result.ok) {
    return result.error === "NOT_FOUND"
      ? apiError(404, "NOT_FOUND")
      : apiError(400, "VALIDATION_FAILED", result.errors, [LIMITS]);
  }
  return NextResponse.json({ profile: result.profile, limits: LIMITS }, { headers: NO_STORE });
}
