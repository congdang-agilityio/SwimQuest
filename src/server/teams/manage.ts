import { parseTeamInput, type TeamErrors } from "@/lib/validation/team";
import { NotFoundError, requireOrganizer } from "@/server/auth/roles";
import { db } from "@/server/db";

/**
 * Organizer team management (FR-31, story S-05). Every write checks `requireOrganizer` first
 * (ForbiddenError / NotFoundError), then validates the input (field errors are returned), then
 * enforces the team rules inside one transaction (TeamRuleError, a 409 for the API).
 */
export class TeamRuleError extends Error {
  readonly status = 409;
  constructor(readonly code: "LIMIT_BELOW_MEMBERS" | "TEAM_NOT_DELETABLE") {
    super(code);
  }
}

type Team = Awaited<ReturnType<typeof db.team.create>>;
type WriteResult = { ok: true; team: Team } | { ok: false; errors: TeamErrors };
type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

const ACTIVE = { status: "ACTIVE" as const };

/** Looks up the team (404 when missing) and requires the user to organize its tournament. */
async function requireTeamOrganizer(userId: string, teamId: string) {
  const team =
    typeof teamId === "string" && teamId.length > 0
      ? await db.team.findUnique({ where: { id: teamId }, select: { tournamentId: true } })
      : null;
  if (!team) throw new NotFoundError();
  return requireOrganizer(userId, team.tournamentId);
}

/** Locks the team row so member joins and other edits wait until this transaction ends. */
async function lockTeam(tx: Tx, teamId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Team" WHERE "id" = ${teamId} FOR UPDATE`;
  if (rows.length === 0) throw new NotFoundError();
}

export async function createTeam(
  userId: string,
  tournamentId: string,
  input: unknown,
): Promise<WriteResult> {
  await requireOrganizer(userId, tournamentId);
  const parsed = parseTeamInput(input);
  if (!parsed.ok) return parsed;
  return { ok: true, team: await db.team.create({ data: { ...parsed.data, tournamentId } }) };
}

/** Updates the form fields; the limit may not drop below the team's active members. */
export async function updateTeam(
  userId: string,
  teamId: string,
  input: unknown,
): Promise<WriteResult> {
  await requireTeamOrganizer(userId, teamId);
  const parsed = parseTeamInput(input);
  if (!parsed.ok) return parsed;
  const team = await db.$transaction(async (tx) => {
    await lockTeam(tx, teamId);
    const members = await tx.teamMember.count({ where: { teamId, ...ACTIVE } });
    if (parsed.data.memberLimit < members) throw new TeamRuleError("LIMIT_BELOW_MEMBERS");
    return tx.team.update({ where: { id: teamId }, data: parsed.data });
  });
  return { ok: true, team };
}

/** Deletes a team only while its tournament is a draft and it has no active members. */
export async function deleteTeam(userId: string, teamId: string): Promise<void> {
  const tournament = await requireTeamOrganizer(userId, teamId);
  await db.$transaction(async (tx) => {
    await lockTeam(tx, teamId);
    const [t] = await tx.$queryRaw<{ status: string }[]>`
      SELECT "status"::text FROM "Tournament" WHERE "id" = ${tournament.id} FOR SHARE`;
    const members = await tx.teamMember.count({ where: { teamId, ...ACTIVE } });
    if (t?.status !== "DRAFT" || members > 0) throw new TeamRuleError("TEAM_NOT_DELETABLE");
    await tx.team.delete({ where: { id: teamId } });
  });
}

/** The tournament's teams (oldest first) with active member counts, and the summed capacity. */
export async function listTeamsWithCounts(tournamentId: string) {
  if (typeof tournamentId !== "string" || tournamentId.length === 0) {
    return { teams: [], capacity: 0 };
  }
  const rows = await db.team.findMany({
    where: { tournamentId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { _count: { select: { members: { where: ACTIVE } } } },
  });
  const teams = rows.map(({ _count, ...team }) => ({ ...team, memberCount: _count.members }));
  const capacity = teams.reduce((sum, team) => sum + team.memberLimit, 0);
  return { teams, capacity };
}
