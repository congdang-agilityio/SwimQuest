import { NextResponse } from "next/server";
import type { QuotaRequestStatus } from "@prisma/client";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { quotaErrorResponse } from "@/server/tournaments/quota-response";
import { listRequests } from "@/server/tournaments/quota";

export const dynamic = "force-dynamic";

/** GET /api/admin/tournament-requests?status=: a platform admin lists quota requests (403 else). */
export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const status = new URL(request.url).searchParams.get("status") ?? undefined;
  try {
    const list = await listRequests(auth.user, status as QuotaRequestStatus | undefined);
    return NextResponse.json({ requests: list }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    const response = quotaErrorResponse(err) ?? roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
}
