import { Prisma } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";

async function clean() {
  await db.dispute.deleteMany();
  await db.reviewHelper.deleteMany();
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
  const result = await db.swimResult.create({
    data: {
      swimId: swim.id,
      tournamentId: tournament.id,
      teamId: team.id,
      userId: swimmer.id,
      status: "REJECTED",
      reasons: ["PACE_TOO_FAST"],
    },
  });
  return { organizer, swimmer, tournament, team, result };
}

function uniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

describe("review decision, dispute, review helper and membership end schema", () => {
  beforeEach(clean);

  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("stores a review decision on a swim result", async () => {
    const { organizer, result } = await setup();
    expect(result).toMatchObject({ decidedById: null, decidedAt: null, decisionNote: null });

    const decided = await db.swimResult.update({
      where: { id: result.id },
      data: {
        status: "VERIFIED",
        decidedById: organizer.id,
        decidedAt: new Date("2026-11-03T08:00:00Z"),
        decisionNote: "Pace checked against the track",
      },
    });

    expect(decided.decidedById).toBe(organizer.id);
    expect(decided.decisionNote).toBe("Pace checked against the track");
  });

  it("allows only one open dispute per swim result", async () => {
    const { swimmer, organizer, result } = await setup();
    const dispute = { swimResultId: result.id, userId: swimmer.id, reason: "GPS drift" };

    const first = await db.dispute.create({ data: { ...dispute, previousStatus: "REJECTED" } });
    expect(first).toMatchObject({ status: "OPEN", decidedById: null, decidedAt: null });

    await expect(
      db.dispute.create({ data: { ...dispute, previousStatus: "REJECTED" } }),
    ).rejects.toSatisfy(uniqueViolation);

    await db.dispute.update({
      where: { id: first.id },
      data: {
        status: "REJECTED",
        decidedById: organizer.id,
        decidedAt: new Date(),
        decisionNote: "Track shows a car ride",
      },
    });
    const second = await db.dispute.create({ data: { ...dispute, previousStatus: "REJECTED" } });
    expect(second.status).toBe("OPEN");
  });

  it("allows only one active review helper per player and tournament", async () => {
    const { organizer, swimmer, tournament } = await setup();
    const helper = { tournamentId: tournament.id, userId: swimmer.id, appointedById: organizer.id };

    const first = await db.reviewHelper.create({ data: helper });
    expect(first.removedAt).toBeNull();

    await expect(db.reviewHelper.create({ data: helper })).rejects.toSatisfy(uniqueViolation);

    await db.reviewHelper.update({ where: { id: first.id }, data: { removedAt: new Date() } });
    await db.reviewHelper.create({ data: helper });
  });

  it("records when and why a team membership ended, keeping one active membership", async () => {
    const { swimmer, tournament, team } = await setup();
    const member = await db.teamMember.create({
      data: { teamId: team.id, tournamentId: tournament.id, userId: swimmer.id },
    });
    expect(member).toMatchObject({ endedAt: null, endReason: null });

    const ended = await db.teamMember.update({
      where: { id: member.id },
      data: { status: "LEFT", endedAt: new Date("2026-11-05T08:00:00Z"), endReason: "SWITCHED" },
    });
    expect(ended.endReason).toBe("SWITCHED");

    await db.teamMember.create({
      data: { teamId: team.id, tournamentId: tournament.id, userId: swimmer.id },
    });
    await expect(
      db.teamMember.create({
        data: { teamId: team.id, tournamentId: tournament.id, userId: swimmer.id },
      }),
    ).rejects.toSatisfy(uniqueViolation);
  });
});
