import { Prisma } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";

async function clean() {
  await db.xpEntry.deleteMany({ where: { reversesId: { not: null } } });
  await db.xpEntry.deleteMany();
  await db.xpWeek.deleteMany();
  await db.badge.deleteMany();
  await db.pointsEntry.deleteMany();
  await db.swimResult.deleteMany();
  await db.swim.deleteMany();
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
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
  const swim = await db.swim.create({
    data: {
      userId: swimmer.id,
      source: "GPX",
      fileSha256: "abc",
      originalFilename: "swim.gpx",
      startedAt: new Date("2026-11-02T06:00:00+07:00"),
      endedAt: new Date("2026-11-02T06:40:00+07:00"),
      distanceM: 1500,
      durationS: 2400,
      swimType: "OPEN_WATER",
      sport: "swimming",
      isSwim: true,
    },
  });
  return { organizer, swimmer, tournament, team, swim };
}

function uniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

describe("badge and XP ledger schema", () => {
  beforeEach(clean);

  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("allows one active badge of a kind per player and tournament", async () => {
    const { swimmer, tournament, team } = await setup();
    const badge = {
      tournamentId: tournament.id,
      userId: swimmer.id,
      kind: "PARTICIPATION" as const,
    };

    const first = await db.badge.create({ data: { ...badge, teamId: team.id } });
    expect(first).toMatchObject({ removedAt: null, removedReason: null, givenById: null });
    expect(first.awardedAt).toBeInstanceOf(Date);

    await expect(db.badge.create({ data: badge })).rejects.toSatisfy(uniqueViolation);

    await db.badge.create({ data: { ...badge, kind: "CONQUEROR" } });
  });

  it("allows a new active badge once the previous one is removed", async () => {
    const { organizer, swimmer, tournament } = await setup();
    const badge = {
      tournamentId: tournament.id,
      userId: swimmer.id,
      kind: "SPECIAL" as const,
      reason: "Helped every week",
      givenById: organizer.id,
    };

    const first = await db.badge.create({ data: badge });
    await db.badge.update({
      where: { id: first.id },
      data: { removedAt: new Date(), removedReason: "Swim revoked" },
    });

    const second = await db.badge.create({ data: badge });
    expect(second.removedAt).toBeNull();
    await expect(db.badge.create({ data: badge })).rejects.toSatisfy(uniqueViolation);
  });

  it("allows one XP entry of a kind per swim", async () => {
    const { swimmer, swim } = await setup();
    const entry = { userId: swimmer.id, swimId: swim.id, vnDay: "2026-11-02" };

    const distance = await db.xpEntry.create({ data: { ...entry, kind: "DISTANCE", xp: 150 } });
    expect(distance.createdAt).toBeInstanceOf(Date);

    await expect(
      db.xpEntry.create({ data: { ...entry, kind: "DISTANCE", xp: 150 } }),
    ).rejects.toSatisfy(uniqueViolation);

    await db.xpEntry.create({ data: { ...entry, kind: "FIRST_SWIM_BONUS", xp: 20 } });
    const reversal = await db.xpEntry.create({
      data: { userId: swimmer.id, kind: "REVERSAL", xp: -150, reversesId: distance.id },
    });
    expect(reversal.reversesId).toBe(distance.id);
  });

  it("stores weekly multiplier entries without a swim and one XP week per player", async () => {
    const { swimmer } = await setup();
    const week = { userId: swimmer.id, weekStart: "2026-11-02" };

    await db.xpEntry.create({ data: { ...week, kind: "WEEKLY_MULTIPLIER", xp: 30 } });
    await db.xpEntry.create({ data: { ...week, kind: "WEEKLY_MULTIPLIER", xp: 10 } });

    const settled = { ...week, multiplierPct: 120, extraXp: 30, settledAt: new Date() };
    await db.xpWeek.create({ data: settled });
    await expect(db.xpWeek.create({ data: settled })).rejects.toSatisfy(uniqueViolation);
  });

  it("rejects malformed day strings", async () => {
    const { swimmer } = await setup();
    await expect(
      db.xpEntry.create({
        data: { userId: swimmer.id, kind: "DISTANCE", xp: 1, vnDay: "02/11/2026" },
      }),
    ).rejects.toThrow();
    await expect(
      db.xpWeek.create({
        data: {
          userId: swimmer.id,
          weekStart: "bad",
          multiplierPct: 100,
          extraXp: 0,
          settledAt: new Date(),
        },
      }),
    ).rejects.toThrow();
  });
});
