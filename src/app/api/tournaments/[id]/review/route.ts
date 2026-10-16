import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { getReviewQueue } from "@/server/review/queue";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/tournaments/:id/review: the tournament's flagged swims for its reviewers (S-43).
 * 200 `{ items }`, oldest flagged first; 403 for anyone else, 404 for an unknown tournament.
 */
export async function GET(_request: Request, { params }: Ctx) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  try {
    const items = await getReviewQueue(auth.user.id, (await params).id);
    return NextResponse.json({ items }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
}
