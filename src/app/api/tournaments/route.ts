import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { createDraft } from "@/server/tournaments/create";
import { QuotaError } from "@/server/tournaments/quota";

export const dynamic = "force-dynamic";

/** POST /api/tournaments: creates a DRAFT organized by the signed-in user (never by the body). */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok) return apiError(400, "INVALID_BODY");

  let result;
  try {
    result = await createDraft(auth.user.id, json.body);
  } catch (error) {
    if (error instanceof QuotaError) return apiError(409, "QUOTA_REACHED");
    throw error;
  }
  if (!result.ok) return apiError(400, "VALIDATION_FAILED", result.errors);
  return NextResponse.json(
    { id: result.id },
    { status: 201, headers: { "cache-control": "no-store" } },
  );
}
