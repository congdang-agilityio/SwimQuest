import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { isValidMomentKey, markSeen } from "@/server/moments/seen";

export const dynamic = "force-dynamic";

/** POST /api/me/moments `{ key }`: the signed-in player has seen a one-time moment. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok) return apiError(400, "INVALID_BODY");
  const key = (json.body as { key?: unknown } | null)?.key;
  if (!isValidMomentKey(key)) return apiError(400, "VALIDATION_FAILED", { key: "INVALID_KEY" });
  await markSeen(auth.user.id, key);
  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
