import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";

async function clean() {
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
  const swim = await db.swim.create({
    data: {
      userId: swimmer.id,
      source: "GPX",
      fileSha256: "a".repeat(64),
      originalFilename: "morning.gpx",
      startedAt: new Date("2026-11-02T06:00:00+07:00"),
      endedAt: new Date("2026-11-02T06:50:00+07:00"),
      distanceM: 2450,
      durationS: 3000,
      swimType: "OPEN_WATER",
      sport: "swimming",
      isSwim: true,
      track: [{ lat: 16.06, lon: 108.24, t: "2026-11-01T23:00:00Z" }],
    },
  });
  return { swimmer, tournament, team, swim };
}

describe("swim, swim result and points entry schema", () => {
  beforeEach(clean);

  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("stores a swim with its private track and defaults", async () => {
    const { swim } = await setup();

    expect(swim).toMatchObject({ duplicateOfId: null, distanceM: 2450, swimType: "OPEN_WATER" });
    expect(swim.track).toEqual([{ lat: 16.06, lon: 108.24, t: "2026-11-01T23:00:00Z" }]);
    expect(swim.createdAt).toBeInstanceOf(Date);
  });

  it("links a duplicate swim to the original", async () => {
    const { swim, swimmer } = await setup();

    const copy = await db.swim.create({
      data: {
        userId: swimmer.id,
        source: "FIT",
        fileSha256: "b".repeat(64),
        originalFilename: "copy.fit",
        startedAt: swim.startedAt,
        endedAt: swim.endedAt,
        distanceM: 2450,
        durationS: 3000,
        swimType: "UNKNOWN",
        sport: "swimming",
        isSwim: true,
        duplicateOfId: swim.id,
      },
    });

    expect(copy).toMatchObject({ duplicateOfId: swim.id, track: null });
  });

  it("creates a swim result with default counted metres and an empty reason list", async () => {
    const { swim, swimmer, tournament, team } = await setup();

    const result = await db.swimResult.create({
      data: {
        swimId: swim.id,
        tournamentId: tournament.id,
        teamId: team.id,
        userId: swimmer.id,
        status: "FLAGGED",
        reasons: ["PACE_TOO_FAST"],
      },
    });

    expect(result).toMatchObject({ countedM: 0, status: "FLAGGED", reasons: ["PACE_TOO_FAST"] });
  });

  it("rejects a second result for the same swim and tournament", async () => {
    const { swim, swimmer, tournament, team } = await setup();
    const data = {
      swimId: swim.id,
      tournamentId: tournament.id,
      teamId: team.id,
      userId: swimmer.id,
      status: "VERIFIED" as const,
      reasons: [],
      countedM: 2450,
    };
    await db.swimResult.create({ data });

    await expect(db.swimResult.create({ data })).rejects.toMatchObject({ code: "P2002" });
  });

  it("rejects a second DISTANCE entry for the same result", async () => {
    const { swim, swimmer, tournament, team } = await setup();
    const result = await db.swimResult.create({
      data: {
        swimId: swim.id,
        tournamentId: tournament.id,
        teamId: team.id,
        userId: swimmer.id,
        status: "VERIFIED",
        reasons: [],
        countedM: 2400,
      },
    });
    const entry = {
      tournamentId: tournament.id,
      userId: swimmer.id,
      teamId: team.id,
      swimResultId: result.id,
      kind: "DISTANCE" as const,
      points: 24,
      countedM: 2400,
      vnDay: "2026-11-02",
    };
    await db.pointsEntry.create({ data: entry });

    await expect(db.pointsEntry.create({ data: entry })).rejects.toMatchObject({ code: "P2002" });
    await expect(
      db.pointsEntry.create({ data: { ...entry, kind: "REVERSAL", points: -24 } }),
    ).resolves.toMatchObject({ kind: "REVERSAL", points: -24 });
  });

  it("rejects a points entry whose day is not YYYY-MM-DD", async () => {
    const { swimmer, tournament, team } = await setup();

    const bad = db.pointsEntry.create({
      data: {
        tournamentId: tournament.id,
        userId: swimmer.id,
        teamId: team.id,
        kind: "FIRST_SWIM_BONUS",
        points: 5,
        vnDay: "2/11/2026",
      },
    });

    await expect(bad).rejects.toThrow(/PointsEntry_vnDay_check/);
  });

  it("rejects a result whose team belongs to another tournament", async () => {
    const { swim, swimmer, tournament, team } = await setup();
    const other = await db.tournament.create({
      data: { ...tournamentCopy(tournament), name: "Other" },
    });

    const mismatched = db.swimResult.create({
      data: {
        swimId: swim.id,
        tournamentId: other.id,
        teamId: team.id,
        userId: swimmer.id,
        status: "VERIFIED",
        reasons: [],
      },
    });

    await expect(mismatched).rejects.toThrow();
  });
});

function tournamentCopy(t: {
  organizerId: string;
  description: string;
  seasonStartAt: Date;
  seasonEndAt: Date;
  routeId: string;
  routeDistanceM: number;
}) {
  const { organizerId, description, seasonStartAt, seasonEndAt, routeId, routeDistanceM } = t;
  return { organizerId, description, seasonStartAt, seasonEndAt, routeId, routeDistanceM };
}
