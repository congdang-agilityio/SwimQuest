import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { getPrivacy, setPrivacy } from "@/server/profile/privacy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

/** GET /api/me/privacy: the signed-in player's privacy levels (defaults filled in). */
export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const privacy = await getPrivacy(auth.user.id);
  if (!privacy) return apiError(404, "NOT_FOUND");
  return NextResponse.json({ privacy }, { headers: NO_STORE });
}

/** PUT /api/me/privacy `{ <field>: level }`: partial update. Unknown field or level is 400. */
export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok) return apiError(400, "INVALID_BODY");
  const result = await setPrivacy(auth.user.id, json.body);
  if (!result.ok) {
    return result.error === "NOT_FOUND"
      ? apiError(404, "NOT_FOUND")
      : apiError(400, "VALIDATION_FAILED");
  }
  return NextResponse.json({ privacy: result.privacy }, { headers: NO_STORE });
}
