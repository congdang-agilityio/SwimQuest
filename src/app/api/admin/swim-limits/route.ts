import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { requirePlatformAdmin, roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import {
  SwimLimitConfigError,
  getSwimLimitConfig,
  setSwimLimitConfig,
} from "@/server/platform/swim-limits-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

/** GET /api/admin/swim-limits: a platform admin reads the swim limit defaults and bounds. */
export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  try {
    requirePlatformAdmin(auth.user);
    return NextResponse.json(await getSwimLimitConfig(), { headers: NO_STORE });
  } catch (err) {
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
}

/**
 * PUT /api/admin/swim-limits `{ defaults, bounds, reason }`: a platform admin saves the limits
 * (audited). 200 with the saved config; 400 `VALIDATION_FAILED` with field errors.
 */
export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok || typeof json.body !== "object" || json.body === null || Array.isArray(json.body))
    return apiError(400, "INVALID_BODY");
  const { reason, ...config } = json.body as { reason?: unknown };
  try {
    const saved = await setSwimLimitConfig(
      auth.user,
      config,
      typeof reason === "string" ? reason : "",
    );
    return NextResponse.json(saved, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof SwimLimitConfigError)
      return apiError(err.status, "VALIDATION_FAILED", err.fieldErrors);
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
}
