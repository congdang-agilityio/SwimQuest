import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { ReportError, closeReport } from "@/server/admin/reports";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/reports/:id `{ status: "HANDLED" | "DISMISSED", note }`: a platform admin
 * closes an open report with an internal note. 200 with the report; 400 INVALID_STATUS or
 * REASON_REQUIRED; 403 for a non-admin; 404; 409 ALREADY_DECIDED.
 */
export async function POST(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok || typeof json.body !== "object" || json.body === null || Array.isArray(json.body))
    return apiError(400, "INVALID_BODY");
  const { status, note } = json.body as { status?: unknown; note?: unknown };
  try {
    const closed = await closeReport(
      auth.user,
      (await params).id,
      status as string,
      note as string,
    );
    return NextResponse.json(closed, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof ReportError) return apiError(err.status, err.code);
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
}
