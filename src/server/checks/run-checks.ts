import type { Swim, SwimResult, Tournament } from "@prisma/client";
import { effectiveStatus } from "@/lib/tournaments/lifecycle";
import type { db } from "@/server/db";
import { emitEvent } from "@/server/events/emit";
import { onVerified as awardAndUpdateProgress } from "@/server/scoring/on-verified";
import { findDuplicateOf } from "./duplicates";
import type { Reason, ReasonCode } from "./reasons";
import { evaluateRules } from "./rule-checks";
import { evaluateSwim } from "./standard-checks";

/** Interactive transaction client of the shared Prisma client. */
export type Tx = Parameters<
  Extract<Parameters<typeof db.$transaction>[0], (tx: never) => unknown>
>[0];

export type RunChecksHooks = {
  /** Called inside the transaction for each VERIFIED result, with the checks' `now`. */
  onVerified?: (tx: Tx, result: SwimResult, now: Date) => Promise<void>;
};

/** By default a verified result gets its points (S-13) and its team's progress (S-19). */
const defaultHooks: Required<RunChecksHooks> = { onVerified: awardAndUpdateProgress };

/**
 * Serializes the uploads of one player until the transaction ends, so two uploads at the same
 * time cannot both miss each other in the duplicate check. Take it before inserting the swim.
 */
export async function lockPlayerSwims(tx: Tx, userId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`swims:${userId}`}))`;
}

/**
 * Checks a stored swim in every tournament where its player has an ACTIVE membership and the
 * tournament is PUBLISHED or ACTIVE at `now` (S-12). A duplicate of an earlier swim gets
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
  // Lock order: onVerified locks each team row until the transaction ends, so teams are handled
  // in ascending teamId order (plain string comparison). Two uploads that touch the same teams
  // then lock them in the same order and cannot deadlock (see updateTeamProgress).
  const active = memberships
    .filter((m) => {
      const status = effectiveStatus(m.tournament, now);
      return status === "PUBLISHED" || status === "ACTIVE";
    })
    .sort((a, b) => (a.teamId < b.teamId ? -1 : a.teamId > b.teamId ? 1 : 0));

  const duplicateOfId = await findDuplicateOf(tx, swim.userId, swim, swim.id);
  if (duplicateOfId) {
    await tx.swim.update({ where: { id: swim.id }, data: { duplicateOfId } });
  }

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
    if (status === "VERIFIED") await onVerified(tx, result, now);
  }
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
