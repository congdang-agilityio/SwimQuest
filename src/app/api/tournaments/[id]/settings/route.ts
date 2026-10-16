import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { requireOrganizer, roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { getSettings, updateSettings } from "@/server/tournaments/update-settings";

export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "no-store" };
type Ctx = { params: Promise<{ id: string }> };

/** GET /api/tournaments/:id/settings: every settings group with its values (organizer only). */
export async function GET(_request: Request, { params }: Ctx) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    await requireOrganizer(auth.user.id, id);
  } catch (err) {
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
  const settings = await getSettings(id);
  if (!settings) return apiError(404, "NOT_FOUND");
  return NextResponse.json({ settings }, { headers: NO_STORE });
}

/** PATCH /api/tournaments/:id/settings with `{ group, values }`: saves one settings group. */
export async function PATCH(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  const body = json.ok ? json.body : null;
  if (typeof body !== "object" || body === null || Array.isArray(body))
    return apiError(400, "INVALID_BODY");
  const { group, values } = body as { group?: unknown; values?: unknown };
  if (typeof group !== "string")
    return apiError(400, "VALIDATION_FAILED", { group: "UNKNOWN_GROUP" });

  let result;
  try {
    result = await updateSettings(auth.user.id, (await params).id, group, values, new Date());
  } catch (err) {
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
  if (result.ok) return NextResponse.json({ group, values: result.values }, { headers: NO_STORE });
  if (result.reason === "SEASON_LOCKED") return apiError(409, "SEASON_LOCKED");
  if (result.reason === "UNKNOWN_GROUP")
    return apiError(400, "VALIDATION_FAILED", { group: "UNKNOWN_GROUP" });
  return apiError(400, "VALIDATION_FAILED", result.errors);
}
