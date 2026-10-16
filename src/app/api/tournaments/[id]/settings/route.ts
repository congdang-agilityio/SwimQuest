import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { requireOrganizer, roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { getSettings, updateSettings } from "@/server/tournaments/update-settings";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
const ok = (body: object) => NextResponse.json(body, { headers: { "cache-control": "no-store" } });

/** Runs `fn`, turning the organizer role errors into their API responses. */
async function guarded<T>(fn: () => Promise<T>): Promise<T | Response> {
  try {
    return await fn();
  } catch (err) {
    return roleErrorResponse(err) ?? Promise.reject(err);
  }
}

/** GET /api/tournaments/:id/settings: every settings group with its values (organizer only). */
export async function GET(_request: Request, { params }: Ctx) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const denied = await guarded(() => requireOrganizer(auth.user.id, id));
  if (denied instanceof Response) return denied;
  const settings = await getSettings(id);
  return settings ? ok({ settings }) : apiError(404, "NOT_FOUND");
}

/** PATCH /api/tournaments/:id/settings with `{ group, values }`: saves one settings group. */
export async function PATCH(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  const body = json.ok ? json.body : null;
  if (typeof body !== "object" || body === null) return apiError(400, "INVALID_BODY");
  const { group, values } = body as { group?: unknown; values?: unknown };

  const { id } = await params;
  const result = await guarded(() =>
    updateSettings(auth.user.id, id, String(group), values, new Date()),
  );
  if (result instanceof Response) return result;
  if (result.ok) return ok({ group, values: result.values });
  if (result.reason === "SEASON_LOCKED") return apiError(409, "SEASON_LOCKED");
  const errors = result.reason === "INVALID" ? result.errors : { group: "UNKNOWN_GROUP" };
  return apiError(400, "VALIDATION_FAILED", errors);
}
