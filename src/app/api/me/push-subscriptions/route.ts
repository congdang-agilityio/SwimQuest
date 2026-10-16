import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import {
  removeSubscription,
  saveSubscription,
  subscriptionSchema,
} from "@/server/push/subscriptions";

export const dynamic = "force-dynamic";
const headers = { "cache-control": "no-store" };

/** GET /api/me/push-subscriptions: the VAPID public key the browser subscribes with. */
export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) return apiError(503, "SERVICE_UNAVAILABLE");
  return NextResponse.json({ publicKey }, { headers });
}

/** POST /api/me/push-subscriptions `{ endpoint, keys }`: register this device. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok) return apiError(400, "INVALID_BODY");
  const parsed = subscriptionSchema.safeParse(json.body);
  if (!parsed.success) return apiError(400, "VALIDATION_FAILED");
  await saveSubscription(auth.user.id, parsed.data);
  return NextResponse.json({ ok: true }, { headers });
}

/** DELETE /api/me/push-subscriptions `{ endpoint }`: remove this device only. */
export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok) return apiError(400, "INVALID_BODY");
  const endpoint = (json.body as { endpoint?: unknown } | null)?.endpoint;
  if (typeof endpoint !== "string" || endpoint.length === 0 || endpoint.length > 2048) {
    return apiError(400, "VALIDATION_FAILED");
  }
  await removeSubscription(auth.user.id, endpoint);
  return NextResponse.json({ ok: true }, { headers });
}
