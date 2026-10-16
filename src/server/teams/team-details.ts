import { parseTeamInput, type TeamErrors } from "@/lib/validation/team";
import { AUDIT_ACTIONS, recordAudit, type AuditClient } from "@/server/audit/record";
import { ForbiddenError, NotFoundError, isOrganizer, requireCaptain } from "@/server/auth/roles";
import { db } from "@/server/db";

const FIELDS = ["name", "emblemKey", "description", "memberLimit"] as const;
type Field = (typeof FIELDS)[number];
type Details = Record<Field, string | number | null>;
type TeamRow = Details & { id: string; tournamentId: string };

/**
 * Records `TEAM_DETAILS_UPDATED` with only the changed fields (before/after) and the actor, using
 * the transaction client of the change. Writes nothing when no field changed.
 */
export async function recordTeamDetailsAudit(
  tx: AuditClient,
  actorUserId: string,
  before: TeamRow,
  after: TeamRow,
): Promise<void> {
  const changed = FIELDS.filter((f) => before[f] !== after[f]);
  if (changed.length === 0) return;
  const pick = (row: TeamRow) => Object.fromEntries(changed.map((f) => [f, row[f]]));
  await recordAudit(tx, {
    actor: { type: "USER", userId: actorUserId },
    action: AUDIT_ACTIONS.TEAM_DETAILS_UPDATED,
    entityType: "Team",
    entityId: before.id,
    tournamentId: before.tournamentId,
    before: pick(before),
    after: pick(after),
  });
}

type Team = Awaited<ReturnType<typeof db.team.update>>;
export type UpdateTeamDetailsResult = { ok: true; team: Team } | { ok: false; errors: TeamErrors };

/**
 * The team's captain or its tournament's organizer changes the name, emblem and description
 * (story S-36, FR-81). Anyone else gets ForbiddenError (NotFoundError for an unknown team). The
 * member limit is not editable here: a captain sending `memberLimit` is refused, and for the
 * organizer it is ignored (use `updateTeam`). The change and its audit event commit together.
 */
export async function updateTeamDetails(
  userId: string,
  teamId: string,
  input: unknown,
): Promise<UpdateTeamDetailsResult> {
  const team =
    typeof teamId === "string" && teamId.length > 0
      ? await db.team.findUnique({ where: { id: teamId } })
      : null;
  if (!team) throw new NotFoundError();
  const organizer = await isOrganizer(userId, team.tournamentId);
  if (!organizer) {
    await requireCaptain(userId, teamId);
    const sent = typeof input === "object" && input !== null && "memberLimit" in input;
    if (sent) throw new ForbiddenError();
  }
  const parsed = parseTeamInput({ ...(input as object), memberLimit: team.memberLimit });
  if (!parsed.ok) return parsed;
  const { name, emblemKey, description } = parsed.data;
  const updated = await db.$transaction(async (tx) => {
    const [before] = await tx.$queryRaw<TeamRow[]>`
      SELECT * FROM "Team" WHERE "id" = ${teamId} FOR UPDATE`;
    if (!before) throw new NotFoundError();
    const next = await tx.team.update({
      where: { id: teamId },
      data: { name, emblemKey, description },
    });
    await recordTeamDetailsAudit(tx, userId, before, next);
    return next;
  });
  return { ok: true, team: updated };
}
