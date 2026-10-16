import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError } from "@/server/auth/roles";
import { AlreadyDecidedError, ReasonRequiredError, decideFlagged } from "./decide";

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

const user = (n: string) =>
  db.user.create({ data: { email: `${n}@example.com`, passwordHash: "h", displayName: n } });

async function tournament(organizerId: string, playerId: string, name: string) {
  const t = await db.tournament.create({
    data: {
      organizerId,
      name,
      description: "d",
      status: "ACTIVE",
      seasonStartAt: new Date("2026-05-01T00:00:00+07:00"),
      seasonEndAt: new Date("2026-07-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100000,
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

async function setup() {
  const organizer = await user("organizer");
  const otherOrganizer = await user("other-organizer");
  const player = await user("player");
  const cup = await tournament(organizer.id, player.id, "Cup");
  const other = await tournament(otherOrganizer.id, player.id, "Other");
  // 1000 m in 3300 s = 5:30 per 100 m, slower than the default limit: flagged in both.
  const swim = await db.swim.create({
    data: {
      userId: player.id,
      source: "GPX",
      fileSha256: "a".repeat(64),
      originalFilename: "swim.gpx",
      startedAt: new Date("2026-06-02T06:00:00+07:00"),
      endedAt: new Date("2026-06-02T06:55:00+07:00"),
      distanceM: 1000,
      durationS: 3300,
      swimType: "OPEN_WATER",
      sport: "swimming",
      isSwim: true,
    },
  });
  const flag = (t: { id: string }, teamId: string) =>
    db.swimResult.create({
      data: {
        swimId: swim.id,
        tournamentId: t.id,
        teamId,
        userId: player.id,
        status: "FLAGGED",
        reasons: ["PACE_TOO_SLOW"],
      },
    });
  const result = await flag(cup.t, cup.team.id);
  const elsewhere = await flag(other.t, other.team.id);
  return { organizer, otherOrganizer, player, cup, other, swim, result, elsewhere };
}

const now = new Date("2026-06-03T10:00:00+07:00");

describe("decideFlagged", () => {
  it("approves: verified, distance points for the player's team, audited and emitted", async () => {
    const { organizer, cup, result, elsewhere, player } = await setup();

    const out = await decideFlagged(organizer.id, result.id, { approve: true }, now);

    expect(out).toEqual({ resultId: result.id, status: "VERIFIED" });
    const row = await db.swimResult.findUniqueOrThrow({ where: { id: result.id } });
    expect(row).toMatchObject({
      status: "VERIFIED",
      decidedById: organizer.id,
      decidedAt: now,
      decisionNote: null,
    });
    const points = await db.pointsEntry.findMany({ where: { swimResultId: result.id } });
    const distance = points.find((p) => p.kind === "DISTANCE");
    expect(distance).toMatchObject({ teamId: cup.team.id, userId: player.id, countedM: 1000 });
    expect(distance!.points).toBeGreaterThan(0);
    // The shared onVerified hook ran: the first-swim bonus and the swim's XP are there too.
    expect(points.some((p) => p.kind !== "DISTANCE")).toBe(true);
    expect(await db.xpEntry.count({ where: { userId: player.id } })).toBeGreaterThan(0);

    const audit = await db.auditEvent.findMany({ where: { action: "SWIM_REVIEWED" } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actorType: "USER",
      actorUserId: organizer.id,
      entityType: "SwimResult",
      entityId: result.id,
      tournamentId: cup.t.id,
      before: { status: "FLAGGED" },
      after: { status: "VERIFIED" },
      reason: null,
    });
    const events = await db.domainEvent.findMany({ where: { type: "SWIM_RESULT_CHANGED" } });
    expect(events).toHaveLength(1);
    expect(events[0]!.payload).toMatchObject({
      resultId: result.id,
      tournamentId: cup.t.id,
      teamId: cup.team.id,
      status: "VERIFIED",
      previousStatus: "FLAGGED",
    });

    // The same swim in the other tournament is untouched and still flagged.
    const other = await db.swimResult.findUniqueOrThrow({ where: { id: elsewhere.id } });
    expect(other).toMatchObject({ status: "FLAGGED", decidedById: null, decidedAt: null });
    expect(await db.pointsEntry.count({ where: { swimResultId: elsewhere.id } })).toBe(0);
  });

  it("rejects with a trimmed note: no points, note stored, audited with the reason", async () => {
    const { organizer, result, elsewhere } = await setup();

    const out = await decideFlagged(
      organizer.id,
      result.id,
      { approve: false, reason: "  Looks like a boat ride  " },
      now,
    );

    expect(out).toEqual({ resultId: result.id, status: "REJECTED" });
    const row = await db.swimResult.findUniqueOrThrow({ where: { id: result.id } });
    expect(row).toMatchObject({
      status: "REJECTED",
      decidedById: organizer.id,
      decidedAt: now,
      decisionNote: "Looks like a boat ride",
      countedM: 0,
    });
    expect(await db.pointsEntry.count()).toBe(0);
    expect(await db.xpEntry.count()).toBe(0);
    const [audit] = await db.auditEvent.findMany({ where: { action: "SWIM_REVIEWED" } });
    expect(audit).toMatchObject({
      after: { status: "REJECTED" },
      reason: "Looks like a boat ride",
    });
    const [event] = await db.domainEvent.findMany({ where: { type: "SWIM_RESULT_CHANGED" } });
    expect(event!.payload).toMatchObject({ status: "REJECTED", previousStatus: "FLAGGED" });
    const other = await db.swimResult.findUniqueOrThrow({ where: { id: elsewhere.id } });
    expect(other.status).toBe("FLAGGED");
  });

  it.each([undefined, "", "   ", "x".repeat(301), 42])(
    "refuses a reject without a valid reason (%s) and changes nothing",
    async (reason) => {
      const { organizer, result } = await setup();
      await expect(
        decideFlagged(organizer.id, result.id, { approve: false, reason: reason as string }, now),
      ).rejects.toBeInstanceOf(ReasonRequiredError);
      const row = await db.swimResult.findUniqueOrThrow({ where: { id: result.id } });
      expect(row.status).toBe("FLAGGED");
      expect(await db.auditEvent.count()).toBe(0);
    },
  );

  it("accepts a reason of exactly 300 characters", async () => {
    const { organizer, result } = await setup();
    await decideFlagged(organizer.id, result.id, { approve: false, reason: "x".repeat(300) }, now);
    const row = await db.swimResult.findUniqueOrThrow({ where: { id: result.id } });
    expect(row.decisionNote).toHaveLength(300);
  });

  it("refuses deciding twice with ALREADY_DECIDED and keeps the first decision", async () => {
    const { organizer, result } = await setup();
    await decideFlagged(organizer.id, result.id, { approve: true }, now);

    const again = decideFlagged(organizer.id, result.id, { approve: false, reason: "no" }, now);
    await expect(again).rejects.toBeInstanceOf(AlreadyDecidedError);
    await expect(again).rejects.toMatchObject({ status: 409, code: "ALREADY_DECIDED" });

    const row = await db.swimResult.findUniqueOrThrow({ where: { id: result.id } });
    expect(row.status).toBe("VERIFIED");
    expect(await db.auditEvent.count({ where: { action: "SWIM_REVIEWED" } })).toBe(1);
    expect(
      await db.pointsEntry.count({ where: { swimResultId: result.id, kind: "DISTANCE" } }),
    ).toBe(1);
  });

  it("lets only one of two concurrent decisions win", async () => {
    const { organizer, result } = await setup();
    const outcomes = await Promise.allSettled([
      decideFlagged(organizer.id, result.id, { approve: true }, now),
      decideFlagged(organizer.id, result.id, { approve: false, reason: "no" }, now),
    ]);
    expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
    const failed = outcomes.find((o) => o.status === "rejected") as PromiseRejectedResult;
    expect(failed.reason).toBeInstanceOf(AlreadyDecidedError);
    expect(await db.auditEvent.count({ where: { action: "SWIM_REVIEWED" } })).toBe(1);
  });

  it("refuses a non-reviewer, including the other tournament's organizer", async () => {
    const { otherOrganizer, player, result } = await setup();
    for (const actor of [player.id, otherOrganizer.id, ""]) {
      await expect(decideFlagged(actor, result.id, { approve: true }, now)).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    }
    const row = await db.swimResult.findUniqueOrThrow({ where: { id: result.id } });
    expect(row.status).toBe("FLAGGED");
    expect(await db.pointsEntry.count()).toBe(0);
    expect(await db.auditEvent.count()).toBe(0);
  });

  it("gives NotFoundError for an unknown or malformed result id", async () => {
    const { organizer } = await setup();
    for (const id of ["missing", "", 7]) {
      await expect(
        decideFlagged(organizer.id, id as string, { approve: true }, now),
      ).rejects.toBeInstanceOf(NotFoundError);
    }
  });
});
