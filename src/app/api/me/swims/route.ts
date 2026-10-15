import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { apiError } from "@/server/http/api-error";
import { InvalidCursorError, listMySwims } from "@/server/swims/my-swims";

export const runtime = "nodejs";

/** GET /api/me/swims?cursor=: the next page of the signed-in player's own swims. */
export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const cursor = new URL(request.url).searchParams.get("cursor") ?? undefined;
  try {
    const page = await listMySwims(auth.user.id, { cursor });
    return NextResponse.json(page, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    // A cursor that is empty, too long or not one we issued.
    if (err instanceof InvalidCursorError || (err instanceof Error && err.name === "ZodError")) {
      return apiError(400, "VALIDATION_FAILED", { cursor: "INVALID_CURSOR" });
    }
    throw err;
  }
}
