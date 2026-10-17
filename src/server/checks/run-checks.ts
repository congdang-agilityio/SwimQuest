import type { Swim, SwimResult, Tournament } from "@prisma/client";
import { effectiveStatus, uploadWindowEndsAt } from "@/lib/tournaments/lifecycle";
import type { db } from "@/server/db";
import { emitEvent } from "@/server/events/emit";
import { awardVerified, refreshTeams, type TeamRef } from "@/server/scoring/on-verified";
import { findDuplicateOf } from "./duplicates";
import type { Reason, ReasonCode } from "./reasons";
import { evaluateRules } from "./rule-checks";
import { evaluateSwim } from "./standard-checks";

/** Interactive transaction client of the shared Prisma client. */
export type Tx = Parameters<
  Extract<Parameters<typeof db.$transaction>[0], (tx: never) => unknown>
>[0];

export type RunChecksHooks = {
  /** Called inside the transaction for each VERIFIED result; returns teams to refresh at the end. */
  onVerified?: (tx: Tx, result: SwimResult, now: Date) => Promise<TeamRef[] | void>;
};

/** By default a verified result gets its points (S-13) and its team's progress (S-19). */
const defaultHooks: Required<RunChecksHooks> = { onVerified: awardVerified };

/**
 * Serializes the uploads of one player until the transaction ends, so two uploads at the same
 * time cannot both miss each other in the duplicate check. Take it before inserting the swim.
 */
export async function lockPlayerSwims(tx: Tx, userId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`swims:${userId}`}))`;
}

/**
 * Whether a swim gets a result in a tournament at `now` (S-12, S-33): while it is PUBLISHED or
 * ACTIVE, and once COMPLETED only during the late-upload window (S-24) and only for a swim that
 * started before the season end time. DRAFT and ARCHIVED tournaments take no new results, nor
 * does a completed one after its window: results are final then, so a too-late upload gets no
 * result rather than UPLOAD_WINDOW_CLOSED.
 */
function takesSwim(tournament: Tournament, swim: Swim, now: Date): boolean {
  const status = effectiveStatus(tournament, now);
  if (status === "PUBLISHED" || status === "ACTIVE") return true;
  if (status !== "COMPLETED") return false;
  return (
    now.getTime() < uploadWindowEndsAt(tournament).getTime() &&
    swim.startedAt.getTime() < tournament.seasonEndAt.getTime()
  );
}

/**
 * Checks a stored swim in every tournament where its player has an ACTIVE membership and the
 * tournament takes the swim at `now` (see takesSwim). A duplicate of an earlier swim gets
 * `duplicateOfId` and a DUPLICATE result per tournament; the original is never touched.
 * Otherwise each tournament gets FLAGGED from its own standard checks; a swim that passes them
 * gets RULE_MISSED (no review, no points) when it misses a tournament rule, else VERIFIED.
 */
export async function runChecks(
  tx: Tx,
  swim: Swim,
  hooks: RunChecksHooks = {},
  now: Date = new Date(),
): Promise<void> {
  const { onVerified } = { ...defaultHooks, ...hooks };
  const memberships = await tx.teamMember.findMany({
    where: { userId: swim.userId, status: "ACTIVE" },
    include: { tournament: true },
    orderBy: { joinedAt: "asc" },
  });
  // Lock order: the changed teams of all memberships are refreshed once at the end, ascending by
  // teamId (plain string comparison), so two uploads, or an upload and a team move, lock team
  // rows in the same order and cannot deadlock (see updateTeamProgress).
  const active = memberships
    .filter((m) => takesSwim(m.tournament, swim, now))
    .sort((a, b) => (a.teamId < b.teamId ? -1 : a.teamId > b.teamId ? 1 : 0));

  const duplicateOfId = await findDuplicateOf(tx, swim.userId, swim, swim.id);
  if (duplicateOfId) {
    await tx.swim.update({ where: { id: swim.id }, data: { duplicateOfId } });
  }

  const changed: TeamRef[] = [];
  for (const m of active) {
    const { status, reasons } = duplicateOfId
      ? { status: "DUPLICATE" as const, reasons: ["DUPLICATE_OF_EARLIER_SWIM"] as ReasonCode[] }
      : checkIn(swim, m.tournament);
    const result = await tx.swimResult.create({
      data: {
        swimId: swim.id,
        tournamentId: m.tournamentId,
        teamId: m.teamId,
        userId: swim.userId,
        status,
        reasons,
      },
    });
    await emitEvent(tx, {
      type: "SWIM_RESULT_CHANGED",
      payload: {
        tournamentId: m.tournamentId,
        teamId: m.teamId,
        userId: swim.userId,
        resultId: result.id,
        swimId: swim.id,
        status,
        previousStatus: null,
      },
    });
    if (status === "VERIFIED") changed.push(...((await onVerified(tx, result, now)) ?? []));
  }
  await refreshTeams(tx, changed, now);
}

/** Standard checks first; only a swim that passes them is checked against the rules. */
function checkIn(
  swim: Swim,
  tournament: Tournament,
): { status: "VERIFIED" | "FLAGGED" | "RULE_MISSED"; reasons: (ReasonCode | Reason)[] } {
  const standard = evaluateSwim(swim, tournament);
  if (standard.status !== "VERIFIED") return standard;
  const { missed } = evaluateRules(swim, tournament);
  return missed.length > 0 ? { status: "RULE_MISSED", reasons: missed } : standard;
}
