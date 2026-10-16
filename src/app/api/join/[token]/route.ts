import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { getJoinView } from "@/server/join/join-view";
import { JoinError, joinTeam } from "@/server/join/join-team";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

const noStore = { "cache-control": "no-store" };

/**
 * POST /api/join/:token with `{ teamId }`: the session user joins that team at once. 200
 * `{ teamId }`, or `{ teamId, alreadyMember: true }` when already in a team of the tournament;
 * 409 `TEAM_FULL`, 410 `JOIN_CLOSED`, 403 `REMOVED_FROM_TOURNAMENT`, 404 unknown token or team.
 */
export async function POST(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok || typeof json.body !== "object" || json.body === null || Array.isArray(json.body))
    return apiError(400, "INVALID_BODY");

  const { token } = await params;
  try {
    const { teamId } = json.body as { teamId?: unknown };
    const { team } = await joinTeam(auth.user.id, token, teamId);
    return NextResponse.json({ teamId: team.id }, { headers: noStore });
  } catch (err) {
    if (!(err instanceof JoinError)) throw err;
    if (err.code === "ALREADY_MEMBER") {
      // After a P2002 race the error may carry no team: look up the current one.
      const team = err.team ?? (await getJoinView(auth.user.id, token))?.myTeam;
      if (team)
        return NextResponse.json({ teamId: team.id, alreadyMember: true }, { headers: noStore });
    }
    return apiError(err.code === "JOIN_CLOSED" ? 410 : err.status, err.code);
  }
}
