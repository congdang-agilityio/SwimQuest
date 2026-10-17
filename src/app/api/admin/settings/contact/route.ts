import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { AdminContactError, setAdminContact } from "@/server/platform/admin-contact";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PUT /api/admin/settings/contact `{ contact }`: a platform admin saves the admin contact shown
 * on the forgot-password page (S-59 AC 1), audited when it changes; "" clears it.
 * 200 `{ contact }` with the saved text; 400 `INVALID_ADMIN_CONTACT`; 403 for a non-admin.
 */
export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok || typeof json.body !== "object" || json.body === null || Array.isArray(json.body))
    return apiError(400, "INVALID_BODY");
  const { contact } = json.body as { contact?: unknown };
  if (typeof contact !== "string") return apiError(400, "INVALID_ADMIN_CONTACT");
  try {
    const saved = await setAdminContact(auth.user, contact);
    return NextResponse.json({ contact: saved }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof AdminContactError) return apiError(err.status, err.code);
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
}
