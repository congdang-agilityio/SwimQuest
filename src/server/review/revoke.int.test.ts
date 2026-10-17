import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError } from "@/server/auth/roles";
import { lockPlayerSwims } from "@/server/checks/run-checks";
import { settleWeek } from "@/server/scoring/settle-week";
import { getTeamPoints } from "@/server/scoring/team-points";
import { decideFlagged, ReasonRequiredError } from "./decide";
import { NotRevokableError, revokeResult } from "./revoke";

async function clean() {
  await db.domainEvent.deleteMany();
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
  await db.notification.deleteMany();
  await db.weeklyResult.deleteMany();
  await db.weekSettlement.deleteMany();
  await db.badge.deleteMany();
  await db.xpWeek.deleteMany();
  await db.xpEntry.deleteMany();
  await db.pointsEntry.deleteMany();
  await db.swimResult.deleteMany();
  await db.swim.deleteMany();
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}

beforeEach(clean);
afterAll(clean);

const user = (n: string, isPlatformAdmin = false) =>
  db.user.create({
    data: { email: `${n}@example.com`, passwordHash: "h", displayName: n, isPlatformAdmin },
  });

async function tournament(organizerId: string, playerId: string, name: string, routeM = 100000) {
  const t = await db.tournament.create({
    data: {
      organizerId,
      name,
      description: "d",
      status: "ACTIVE",
      seasonStartAt: new Date("2026-05-01T00:00:00+07:00"),
      seasonEndAt: new Date("2026-07-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: routeM,
      dailyLimitM: 1500,
    },
  });
  const team = await db.team.create({
    data: { tournamentId: t.id, name: `${name}-team`, emblemKey: "dolphin", memberLimit: 5 },
  });
  await db.teamMember.create({
    data: { tournamentId: t.id, teamId: team.id, userId: playerId, status: "ACTIVE" },
  });
  return { t, team };
}

let seq = 0;
/** A 1000 m swim on `day` (Vietnam time), FLAGGED in each given tournament. */
async function flaggedSwim(
  playerId: string,
  day: string,
  where: { t: { id: string }; team: { id: string } }[],
) {
  seq += 1;
  const swim = await db.swim.create({
    data: {
      userId: playerId,
      source: "GPX",
      fileSha256: seq.toString(16).padStart(64, "0"),
      originalFilename: `swim-${seq}.gpx`,
      startedAt: new Date(`${day}T06:00:00+07:00`),
      endedAt: new Date(`${day}T06:55:00+07:00`),
      distanceM: 1000,
      durationS: 3300,
      swimType: "OPEN_WATER",
      sport: "swimming",
      isSwim: true,
    },
  });
  const results = [];
  for (const { t, team } of where) {
    results.push(
      await db.swimResult.create({
        data: {
          swimId: swim.id,
          tournamentId: t.id,
          teamId: team.id,
          userId: playerId,
          status: "FLAGGED",
          reasons: ["PACE_TOO_SLOW"],
        },
      }),
    );
  }
  return { swim, results };
}

const approved = new Date("2026-06-03T10:00:00+07:00");
const now = new Date("2026-06-04T10:00:00+07:00");

async function setup(routeM?: number) {
  const organizer = await user("organizer");
  const otherOrganizer = await user("other-organizer");
  const player = await user("player");
  const cup = await tournament(organizer.id, player.id, "Cup", routeM);
  const other = await tournament(otherOrganizer.id, player.id, "Other");
  return { organizer, otherOrganizer, player, cup, other };
}

describe("revokeResult", () => {
  it("revokes: one REVERSAL nets the points, history kept, team total drops, audited", async () => {
    const { organizer, otherOrganizer, player, cup, other } = await setup();
    const {
      swim,
      results: [result, elsewhere],
    } = await flaggedSwim(player.id, "2026-06-02", [cup, other]);
    await decideFlagged(organizer.id, result.id, { approve: true }, approved);
    await decideFlagged(otherOrganizer.id, elsewhere.id, { approve: true }, approved);
    const before = await db.pointsEntry.findMany({ where: { swimResultId: result.id } });
    expect(await getTeamPoints(cup.t.id, cup.team.id)).toBe(40);
    const xpBefore = await db.xpEntry.findMany({ where: { userId: player.id } });

    const out = await revokeResult(organizer.id, result.id, "  Boat ride  ", { now });

    expect(out).toEqual({ resultId: result.id, status: "REVOKED" });
    const row = await db.swimResult.findUniqueOrThrow({ where: { id: result.id } });
    expect(row).toMatchObject({
      status: "REVOKED",
      decisionNote: "Boat ride",
      decidedById: organizer.id,
      decidedAt: now,
    });
    const entries = await db.pointsEntry.findMany({
      where: { swimResultId: result.id },
      orderBy: { createdAt: "asc" },
    });
    // Earlier entries are untouched; one REVERSAL carries the negative points and metres.
    expect(entries.filter((e) => e.kind !== "REVERSAL")).toEqual(before);
    const reversal = entries.filter((e) => e.kind === "REVERSAL");
    expect(reversal).toHaveLength(1);
    expect(reversal[0]).toMatchObject({
      points: -40,
      countedM: -1000,
      teamId: cup.team.id,
      userId: player.id,
      vnDay: "2026-06-02",
    });
    expect(await getTeamPoints(cup.t.id, cup.team.id)).toBe(0);

    // The other tournament's result, its points and the swim's XP are unchanged.
    const kept = await db.swimResult.findUniqueOrThrow({ where: { id: elsewhere.id } });
    expect(kept.status).toBe("VERIFIED");
    expect(await getTeamPoints(other.t.id, other.team.id)).toBe(40);
    expect(await db.xpEntry.findMany({ where: { userId: player.id } })).toEqual(xpBefore);

    const audit = await db.auditEvent.findMany({ where: { action: "SWIM_REVOKED" } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actorType: "USER",
      actorUserId: organizer.id,
      entityType: "SwimResult",
      entityId: result.id,
      tournamentId: cup.t.id,
      before: { status: "VERIFIED" },
      after: { status: "REVOKED" },
      reason: "Boat ride",
    });
    expect(audit[0]!.createdAt).toBeInstanceOf(Date);
    const events = await db.domainEvent.findMany({
      where: { type: "SWIM_RESULT_CHANGED", tournamentId: cup.t.id },
      orderBy: { createdAt: "asc" },
    });
    expect(events.at(-1)!.payload).toMatchObject({
      resultId: result.id,
      swimId: swim.id,
      teamId: cup.team.id,
      userId: player.id,
      status: "REVOKED",
      previousStatus: "VERIFIED",
    });
  });

  it("removes the swim's XP when it counts in no other tournament", async () => {
    const { organizer, player, cup, other } = await setup();
    const {
      results: [result],
    } = await flaggedSwim(player.id, "2026-06-02", [cup, other]);
    await decideFlagged(organizer.id, result.id, { approve: true }, approved);
    const total = async () =>
      (await db.xpEntry.aggregate({ where: { userId: player.id }, _sum: { xp: true } }))._sum.xp;
    expect(await total()).toBeGreaterThan(0);

    await revokeResult(organizer.id, result.id, "Not a swim", { now });

    expect(await total()).toBe(0);
    expect(await db.xpEntry.count({ where: { kind: "REVERSAL" } })).toBeGreaterThan(0);
  });

  it("recalculates a settled week's multiplier without the revoked swim", async () => {
    const { organizer, player, cup } = await setup();
    const ids: string[] = [];
    for (const day of ["2026-06-01", "2026-06-02", "2026-06-03"]) {
      const { results } = await flaggedSwim(player.id, day, [cup]);
      await decideFlagged(organizer.id, results[0].id, { approve: true }, approved);
      ids.push(results[0].id);
    }
    await settleWeek(cup.t.id, "2026-06-01", new Date("2026-06-09T01:00:00+07:00"));
    const settled = await db.weeklyResult.findFirstOrThrow({ where: { userId: player.id } });
    expect(settled).toMatchObject({ activeDays: 3, multiplierPct: 120 });

    await revokeResult(organizer.id, ids[1], "Duplicate upload", {
      now: new Date("2026-06-10T10:00:00+07:00"),
    });

    const week = await db.weeklyResult.findFirstOrThrow({ where: { userId: player.id } });
    expect(week).toMatchObject({ activeDays: 2, multiplierPct: 110, distancePoints: 20 });
    expect(week.extraPoints).toBeLessThan(settled.extraPoints);
    const multiplier = await db.pointsEntry.aggregate({
      where: { tournamentId: cup.t.id, kind: "WEEKLY_MULTIPLIER" },
      _sum: { points: true },
    });
    expect(multiplier._sum.points).toBe(week.extraPoints);
  });

  it("withdraws the finish of a team that drops below 100%", async () => {
    const { organizer, player, cup } = await setup(1000);
    const {
      results: [result],
    } = await flaggedSwim(player.id, "2026-06-02", [cup]);
    await decideFlagged(organizer.id, result.id, { approve: true }, approved);
    const finished = await db.team.findUniqueOrThrow({ where: { id: cup.team.id } });
    expect(finished.finishedAt).not.toBeNull();

    await revokeResult(organizer.id, result.id, "Boat ride", { now });

    const team = await db.team.findUniqueOrThrow({ where: { id: cup.team.id } });
    expect(team).toMatchObject({
      finishedAt: null,
      finishLostAt: now,
      finishLostReason: "SWIM_REVOKED",
      progressBp: 0,
    });
    expect(await db.domainEvent.count({ where: { type: "TEAM_FINISH_LOST" } })).toBe(1);
  });

  it("frees the revoked metres of the day's limit for a later swim", async () => {
    const { organizer, player, cup } = await setup();
    const first = await flaggedSwim(player.id, "2026-06-02", [cup]);
    await decideFlagged(organizer.id, first.results[0].id, { approve: true }, approved);
    await revokeResult(organizer.id, first.results[0].id, "Boat ride", { now });

    const second = await flaggedSwim(player.id, "2026-06-02", [cup]);
    await decideFlagged(organizer.id, second.results[0].id, { approve: true }, now);

    const row = await db.swimResult.findUniqueOrThrow({ where: { id: second.results[0].id } });
    expect(row.countedM).toBe(1000); // daily limit 1500: the revoked 1000 m no longer count
  });

  it("lets a platform admin revoke with asAdmin, and only a platform admin", async () => {
    const { organizer, player, cup } = await setup();
    const admin = await user("admin", true);
    const {
      results: [result],
    } = await flaggedSwim(player.id, "2026-06-02", [cup]);
    await decideFlagged(organizer.id, result.id, { approve: true }, approved);

    await expect(revokeResult(admin.id, result.id, "Override", { now })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      revokeResult(player.id, result.id, "Override", { asAdmin: true, now }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await revokeResult(admin.id, result.id, "Override", { asAdmin: true, now });

    const [audit] = await db.auditEvent.findMany({ where: { action: "SWIM_REVOKED" } });
    expect(audit).toMatchObject({ actorUserId: admin.id, reason: "Override" });
  });

  it("refuses a non-reviewer, including the other tournament's organizer", async () => {
    const { organizer, otherOrganizer, player, cup } = await setup();
    const {
      results: [result],
    } = await flaggedSwim(player.id, "2026-06-02", [cup]);
    await decideFlagged(organizer.id, result.id, { approve: true }, approved);

    for (const actor of [player.id, otherOrganizer.id, ""]) {
      await expect(revokeResult(actor, result.id, "No", { now })).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    }
    const row = await db.swimResult.findUniqueOrThrow({ where: { id: result.id } });
    expect(row.status).toBe("VERIFIED");
    expect(await db.pointsEntry.count({ where: { kind: "REVERSAL" } })).toBe(0);
    expect(await db.auditEvent.count({ where: { action: "SWIM_REVOKED" } })).toBe(0);
  });

  it.each([undefined, "", "   ", "x".repeat(301), 42])("requires a reason (%s)", async (reason) => {
    const { organizer, player, cup } = await setup();
    const {
      results: [result],
    } = await flaggedSwim(player.id, "2026-06-02", [cup]);
    await decideFlagged(organizer.id, result.id, { approve: true }, approved);
    await expect(
      revokeResult(organizer.id, result.id, reason as string, { now }),
    ).rejects.toBeInstanceOf(ReasonRequiredError);
    const row = await db.swimResult.findUniqueOrThrow({ where: { id: result.id } });
    expect(row.status).toBe("VERIFIED");
  });

  it("refuses results that are not VERIFIED with NOT_REVOKABLE, and a second revoke", async () => {
    const { organizer, player, cup } = await setup();
    const {
      results: [result],
    } = await flaggedSwim(player.id, "2026-06-02", [cup]);

    const flagged = revokeResult(organizer.id, result.id, "No", { now });
    await expect(flagged).rejects.toBeInstanceOf(NotRevokableError);
    await expect(flagged).rejects.toMatchObject({ status: 409, code: "NOT_REVOKABLE" });

    await decideFlagged(organizer.id, result.id, { approve: true }, approved);
    await revokeResult(organizer.id, result.id, "No", { now });
    await expect(revokeResult(organizer.id, result.id, "Again", { now })).rejects.toBeInstanceOf(
      NotRevokableError,
    );
    expect(await db.pointsEntry.count({ where: { kind: "REVERSAL" } })).toBe(1);
    expect(await db.auditEvent.count({ where: { action: "SWIM_REVOKED" } })).toBe(1);
  });

  it("gives NotFoundError for an unknown or malformed result id", async () => {
    const { organizer } = await setup();
    for (const id of ["missing", "", 7]) {
      await expect(revokeResult(organizer.id, id as string, "No", { now })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    }
  });

  it("waits for the player's swims lock, the same lock order as an upload", async () => {
    const { organizer, player, cup } = await setup();
    const {
      results: [result],
    } = await flaggedSwim(player.id, "2026-06-02", [cup]);
    await decideFlagged(organizer.id, result.id, { approve: true }, approved);
    let settled = false;
    let pending: Promise<unknown> | undefined;

    await db.$transaction(async (tx) => {
      await lockPlayerSwims(tx, player.id);
      pending = revokeResult(organizer.id, result.id, "No", { now }).finally(
        () => (settled = true),
      );
      await new Promise((r) => setTimeout(r, 300));
      expect(settled).toBe(false);
    });
    await expect(pending).resolves.toEqual({ resultId: result.id, status: "REVOKED" });
  });
});
