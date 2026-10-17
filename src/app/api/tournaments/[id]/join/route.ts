import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { findMyTeam } from "@/server/join/join-view";
import { JoinError } from "@/server/join/join-team";
import { joinPublic } from "@/server/join/public-join";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const noStore = { "cache-control": "no-store" };

/**
 * POST /api/tournaments/:id/join with `{ teamId }`: the session user joins that team of a public
 * tournament at once, with no invite link and no approval (S-30). 200 `{ teamId }`, or
 * `{ teamId, alreadyMember: true }` when already in a team of the tournament; 409 `TEAM_FULL`,
 * 410 `JOIN_CLOSED`, 403 `REMOVED_FROM_TOURNAMENT`, 404 `NOT_PUBLIC` for an invite-only
 * tournament, 404 `NOT_FOUND` for an unknown tournament or team.
 */
export async function POST(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok || typeof json.body !== "object" || json.body === null || Array.isArray(json.body))
    return apiError(400, "INVALID_BODY");

  const { id } = await params;
  try {
    const { teamId } = json.body as { teamId?: unknown };
    const { team } = await joinPublic(auth.user.id, id, teamId);
    return NextResponse.json({ teamId: team.id }, { headers: noStore });
  } catch (err) {
    if (!(err instanceof JoinError)) throw err;
    if (err.code === "ALREADY_MEMBER") {
      // After a P2002 race the error may carry no team: look up the current one.
      const team = err.team ?? (await findMyTeam(auth.user.id, id));
      if (team)
        return NextResponse.json({ teamId: team.id, alreadyMember: true }, { headers: noStore });
    }
    return apiError(err.code === "JOIN_CLOSED" ? 410 : err.status, err.code);
  }
}
