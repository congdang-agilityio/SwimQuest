import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { recordFunnelEvent } from "@/server/funnel/record";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { recordHealthSignal } from "@/server/telemetry/health";
import { allowTelemetry } from "@/server/telemetry/rate-limit";

export const dynamic = "force-dynamic";

/** A same-site path such as `/art/mockup/logo.webp`: no host, query string or odd characters. */
const assetPath = z
  .string()
  .max(200)
  .regex(/^\/(?!\/)[A-Za-z0-9._~\-/%]*$/);

const body = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ASSET_FAILURE"), path: assetPath }),
  z.object({ kind: z.literal("INVITE_SHARED"), teamId: z.string().min(1).max(80) }),
]);

/**
 * POST /api/telemetry (signed in): `{ kind: "ASSET_FAILURE", path }` counts a failed asset load;
 * `{ kind: "INVITE_SHARED", teamId }` records `team_invite_sent`, only when the user is that
 * team's captain (anyone else is ignored). 204 when handled, 400 for an unknown kind or bad
 * body, 429 above 20 reports per minute. Nothing personal is stored.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  if (!allowTelemetry(auth.user.id)) return apiError(429, "RATE_LIMITED");
  const json = await readJson(request);
  if (!json.ok) return apiError(400, "INVALID_BODY");
  const parsed = body.safeParse(json.body);
  if (!parsed.success) return apiError(400, "VALIDATION_FAILED");

  const data = parsed.data;
  if (data.kind === "ASSET_FAILURE") {
    await recordHealthSignal("ASSET_FAILURE", data.path);
  } else {
    try {
      const team = await db.team.findUnique({
        where: { id: data.teamId },
        select: { id: true, tournamentId: true, captainUserId: true },
      });
      if (team && team.captainUserId === auth.user.id) {
        await recordFunnelEvent(db, "team_invite_sent", {
          userId: auth.user.id,
          tournamentId: team.tournamentId,
          refId: team.id,
        });
      }
    } catch (error) {
      console.error("telemetry: invite share not recorded", error);
    }
  }
  return new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } });
}
