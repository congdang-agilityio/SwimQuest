import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { ReportError, listReports } from "@/server/admin/reports";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/reports?status=&cursor=: a platform admin lists reports (open first). 403 for
 * a non-admin; 400 INVALID_STATUS. The reporter is part of the answer, for admins only.
 */
export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const params = new URL(request.url).searchParams;
  try {
    const list = await listReports(
      auth.user,
      params.get("status") ?? undefined,
      params.get("cursor") ?? undefined,
    );
    return NextResponse.json(list, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof ReportError) return apiError(err.status, err.code);
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
}
