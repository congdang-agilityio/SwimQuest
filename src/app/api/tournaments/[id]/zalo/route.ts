import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, publicOrigin, readJson } from "@/server/http/request";
import { ZaloSecretError } from "@/server/zalo/secret";
import {
  getZaloSettings,
  removeZaloBot,
  saveZaloBotKey,
  ZaloSettingsError,
  type ZaloSettings,
} from "@/server/zalo/settings";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const KeyBody = z.object({ key: z.string().trim().min(10).max(200) });

function view(zalo: ZaloSettings | null) {
  return NextResponse.json({ zalo }, { headers: { "cache-control": "no-store" } });
}

/** Maps a refused change to its answer. Nothing here carries the key (S-85 AC 2). */
function failure(err: unknown) {
  const response = roleErrorResponse(err);
  if (response) return response;
  if (err instanceof ZaloSettingsError) {
    switch (err.code) {
      case "ZALO_KEY_REJECTED":
        return apiError(400, "ZALO_KEY_REJECTED");
      case "ZALO_UNREACHABLE":
        return apiError(502, "ZALO_UNREACHABLE");
      case "TOURNAMENT_CLOSED":
        return apiError(409, "TOURNAMENT_CLOSED");
      case "INVALID_KEY":
        return apiError(400, "VALIDATION_FAILED", { key: "This is not a Zalo bot key." });
      case "INVALID_ORIGIN":
        return apiError(503, "SERVICE_UNAVAILABLE");
    }
  }
  // Zalo is not configured on this server (ZALO_KEY_SECRET missing): never the key's fault.
  if (err instanceof ZaloSecretError) return apiError(503, "SERVICE_UNAVAILABLE");
  throw err;
}

/** GET /api/tournaments/:id/zalo: the organizer's view of the bot (never the key), or null. */
export async function GET(_request: Request, { params }: Ctx) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  try {
    return view(await getZaloSettings(auth.user.id, (await params).id));
  } catch (err) {
    return failure(err);
  }
}

/**
 * PUT /api/tournaments/:id/zalo `{ key }`: checks the key with Zalo, saves it encrypted and
 * registers the webhook at the public origin. The body is never logged or echoed.
 */
export async function PUT(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok || typeof json.body !== "object" || json.body === null || Array.isArray(json.body)) {
    return apiError(400, "INVALID_BODY");
  }
  const parsed = KeyBody.safeParse(json.body);
  if (!parsed.success) {
    // Fields only: zod issues could carry the submitted value.
    return apiError(400, "VALIDATION_FAILED", { key: "Enter the bot key (10 to 200 characters)." });
  }
  let origin: string;
  try {
    origin = publicOrigin(request);
  } catch {
    return apiError(503, "SERVICE_UNAVAILABLE");
  }
  try {
    return view(await saveZaloBotKey(auth.user.id, (await params).id, parsed.data.key, origin));
  } catch (err) {
    return failure(err);
  }
}

/** DELETE /api/tournaments/:id/zalo: removes the bot from this tournament only. */
export async function DELETE(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  try {
    await removeZaloBot(auth.user.id, (await params).id);
    return view(null);
  } catch (err) {
    return failure(err);
  }
}
