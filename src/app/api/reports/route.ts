import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { createReport } from "@/server/reports/create";

export const dynamic = "force-dynamic";

/** POST /api/reports: sends a problem report to the admins. Replies with a confirmation only. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok) return apiError(400, "INVALID_BODY");

  const result = await createReport(auth.user.id, json.body);
  if (!result.ok) {
    if (result.reason === "VALIDATION") return apiError(400, "VALIDATION_FAILED", result.errors);
    if (result.reason === "NOT_FOUND") return apiError(404, "NOT_FOUND");
    return apiError(429, "RATE_LIMITED");
  }
  return NextResponse.json({ ok: true }, { status: 201, headers: { "cache-control": "no-store" } });
}
