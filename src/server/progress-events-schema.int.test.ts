import { Prisma } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";

async function clean() {
  await db.weekSettlement.deleteMany();
  await db.weeklyResult.deleteMany();
  await db.seenMoment.deleteMany();
  await db.domainEvent.deleteMany();
  await db.xpEntry.deleteMany();
  await db.pointsEntry.deleteMany();
  await db.swimResult.deleteMany();
  await db.swim.deleteMany();
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
  await db.session.deleteMany();
  await db.user.deleteMany();
}

async function setup() {
  const organizer = await db.user.create({
    data: { email: "organizer@example.com", passwordHash: "hash", displayName: "Organizer" },
  });
  const swimmer = await db.user.create({
    data: { email: "swimmer@example.com", passwordHash: "hash", displayName: "Swimmer" },
  });
  const tournament = await db.tournament.create({
    data: {
      organizerId: organizer.id,
      name: "Summer Swim",
      description: "A season of swimming",
      seasonStartAt: new Date("2026-11-01T00:00:00+07:00"),
      seasonEndAt: new Date("2026-12-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 1650000,
    },
  });
  const team = await db.team.create({
    data: { tournamentId: tournament.id, name: "Dolphins", emblemKey: "dolphin", memberLimit: 5 },
  });
  return { swimmer, tournament, team };
}

function weeklyResult(ids: { tournamentId: string; userId: string; teamId: string }) {
  return {
    ...ids,
    weekStart: "2026-11-02",
    activeDays: 3,
    multiplierPct: 125,
    distancePoints: 40,
    extraPoints: 10,
    streakWeeks: 2,
    settledAt: new Date("2026-11-09T00:05:00+07:00"),
  };
}

function uniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

describe("team progress, domain event, seen moment and weekly result schema", () => {
  beforeEach(clean);

  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("gives a team a zero progress cache and no finish by default", async () => {
    const { team } = await setup();

    expect(team).toMatchObject({
      progressBp: 0,
      finishedAt: null,
      finishLostAt: null,
      finishLostReason: null,
    });
  });

  it("stores a team finish and a lost finish", async () => {
    const { team } = await setup();

    const updated = await db.team.update({
      where: { id: team.id },
      data: {
        progressBp: 10000,
        finishedAt: new Date("2026-11-20T08:00:00Z"),
        finishLostAt: new Date("2026-11-21T08:00:00Z"),
        finishLostReason: "SWIM_REVOKED",
      },
    });

    expect(updated.progressBp).toBe(10000);
    expect(updated.finishedAt?.toISOString()).toBe("2026-11-20T08:00:00.000Z");
    expect(updated.finishLostReason).toBe("SWIM_REVOKED");
  });

  it("stores a domain event with or without a tournament", async () => {
    const { tournament } = await setup();

    const event = await db.domainEvent.create({
      data: { type: "TEAM_FINISHED", tournamentId: tournament.id, payload: { teamId: "t1" } },
    });
    const global = await db.domainEvent.create({ data: { type: "SYSTEM_NOTICE", payload: {} } });

    expect(event.payload).toEqual({ teamId: "t1" });
    expect(event.createdAt).toBeInstanceOf(Date);
    expect(global.tournamentId).toBeNull();
  });

  it("records a moment as seen only once per user", async () => {
    const { swimmer } = await setup();

    const seen = await db.seenMoment.create({ data: { userId: swimmer.id, key: "finish:t1" } });
    expect(seen.seenAt).toBeInstanceOf(Date);

    await expect(
      db.seenMoment.create({ data: { userId: swimmer.id, key: "finish:t1" } }),
    ).rejects.toSatisfy(uniqueViolation);
    await db.seenMoment.create({ data: { userId: swimmer.id, key: "finish:t2" } });
  });

  it("keeps one weekly result per user, tournament and week", async () => {
    const { swimmer, tournament, team } = await setup();
    const ids = { tournamentId: tournament.id, userId: swimmer.id, teamId: team.id };

    const result = await db.weeklyResult.create({ data: weeklyResult(ids) });
    expect(result.updatedAt).toBeInstanceOf(Date);

    await expect(db.weeklyResult.create({ data: weeklyResult(ids) })).rejects.toSatisfy(
      uniqueViolation,
    );
    await db.weeklyResult.create({ data: { ...weeklyResult(ids), weekStart: "2026-11-09" } });
  });

  it("rejects a weekly result whose week start is not a YYYY-MM-DD day", async () => {
    const { swimmer, tournament, team } = await setup();
    const ids = { tournamentId: tournament.id, userId: swimmer.id, teamId: team.id };

    await expect(
      db.weeklyResult.create({ data: { ...weeklyResult(ids), weekStart: "02/11/2026" } }),
    ).rejects.toThrow();
  });

  it("settles a week only once per tournament", async () => {
    const { tournament } = await setup();
    const settlement = { tournamentId: tournament.id, weekStart: "2026-11-02" };

    await db.weekSettlement.create({ data: settlement });

    await expect(db.weekSettlement.create({ data: settlement })).rejects.toSatisfy(uniqueViolation);
    await db.weekSettlement.create({ data: { ...settlement, weekStart: "2026-11-09" } });
  });
});
