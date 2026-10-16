import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { db } from "./db";

async function makeUser(email: string) {
  return db.user.create({ data: { email, passwordHash: "hash", displayName: email } });
}

async function makeTournament(organizerId: string, name = "Summer Swim") {
  return db.tournament.create({
    data: {
      organizerId,
      name,
      description: "A season of swimming",
      seasonStartAt: new Date("2026-11-01T00:00:00+07:00"),
      seasonEndAt: new Date("2026-12-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 1650000,
    },
  });
}

async function makeTeam(tournamentId: string, name: string, memberLimit = 5) {
  return db.team.create({ data: { tournamentId, name, emblemKey: "wave", memberLimit } });
}

describe("tournament, team and team member schema", () => {
  async function clean() {
    await db.teamMember.deleteMany();
    await db.team.deleteMany();
    await db.tournament.deleteMany();
    await db.$executeRaw`TRUNCATE "AuditEvent"`;
    await db.session.deleteMany();
    await db.user.deleteMany();
  }

  beforeEach(clean);

  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("creates a tournament with the P0 setting defaults", async () => {
    const organizer = await makeUser("organizer@example.com");

    const tournament = await makeTournament(organizer.id);

    expect(tournament).toMatchObject({
      status: "DRAFT",
      fastestPaceSecPer100m: 65,
      slowestPaceSecPer100m: 300,
      longestRealisticSwimM: 30000,
      longestSwimCountedM: 10000,
      dailyLimitM: 10000,
      pointsPerKm: 10,
      startChoiceDeadlineAt: null,
      inviteToken: null,
      publishedAt: null,
    });
    expect(tournament.seasonStartAt.toISOString()).toBe("2026-10-31T17:00:00.000Z");
  });

  it("rejects a duplicate invite token", async () => {
    const organizer = await makeUser("organizer@example.com");
    const first = await makeTournament(organizer.id, "One");
    const second = await makeTournament(organizer.id, "Two");
    await db.tournament.update({ where: { id: first.id }, data: { inviteToken: "tok" } });

    const duplicate = db.tournament.update({
      where: { id: second.id },
      data: { inviteToken: "tok" },
    });

    await expect(duplicate).rejects.toMatchObject({ code: "P2002" });
  });

  it("creates a team with an optional captain and start choice", async () => {
    const organizer = await makeUser("organizer@example.com");
    const captain = await makeUser("captain@example.com");
    const tournament = await makeTournament(organizer.id);

    const team = await db.team.create({
      data: {
        tournamentId: tournament.id,
        name: "Dolphins",
        emblemKey: "dolphin",
        memberLimit: 4,
        captainUserId: captain.id,
        startDestination: "hue",
        startSetAt: new Date(),
        startSetBy: "CAPTAIN",
      },
    });

    expect(team).toMatchObject({ description: null, startSetBy: "CAPTAIN", memberLimit: 4 });
  });

  it("rejects a member limit below 1", async () => {
    const organizer = await makeUser("organizer@example.com");
    const tournament = await makeTournament(organizer.id);

    await expect(makeTeam(tournament.id, "Empty", 0)).rejects.toThrow(/Team_memberLimit_check/);
  });

  it("rejects a second active membership in the same tournament", async () => {
    const organizer = await makeUser("organizer@example.com");
    const swimmer = await makeUser("swimmer@example.com");
    const tournament = await makeTournament(organizer.id);
    const teamA = await makeTeam(tournament.id, "A");
    const teamB = await makeTeam(tournament.id, "B");
    await db.teamMember.create({
      data: { teamId: teamA.id, tournamentId: tournament.id, userId: swimmer.id },
    });

    const second = db.teamMember.create({
      data: { teamId: teamB.id, tournamentId: tournament.id, userId: swimmer.id },
    });

    await expect(second).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    await expect(second).rejects.toMatchObject({ code: "P2002" });
  });

  it("allows a new active membership after the previous one was left", async () => {
    const organizer = await makeUser("organizer@example.com");
    const swimmer = await makeUser("swimmer@example.com");
    const tournament = await makeTournament(organizer.id);
    const teamA = await makeTeam(tournament.id, "A");
    const teamB = await makeTeam(tournament.id, "B");
    await db.teamMember.create({
      data: { teamId: teamA.id, tournamentId: tournament.id, userId: swimmer.id, status: "LEFT" },
    });

    const active = await db.teamMember.create({
      data: { teamId: teamB.id, tournamentId: tournament.id, userId: swimmer.id },
    });

    expect(active).toMatchObject({ status: "ACTIVE" });
    expect(active.joinedAt).toBeInstanceOf(Date);
    await expect(db.teamMember.count({ where: { userId: swimmer.id } })).resolves.toBe(2);
  });

  it("allows active memberships in different tournaments", async () => {
    const organizer = await makeUser("organizer@example.com");
    const swimmer = await makeUser("swimmer@example.com");
    const one = await makeTournament(organizer.id, "One");
    const two = await makeTournament(organizer.id, "Two");
    const teamOne = await makeTeam(one.id, "A");
    const teamTwo = await makeTeam(two.id, "A");

    await db.teamMember.create({
      data: { teamId: teamOne.id, tournamentId: one.id, userId: swimmer.id },
    });
    await db.teamMember.create({
      data: { teamId: teamTwo.id, tournamentId: two.id, userId: swimmer.id },
    });

    await expect(db.teamMember.count({ where: { status: "ACTIVE" } })).resolves.toBe(2);
  });

  it("rejects a membership whose tournament differs from its team's tournament", async () => {
    const organizer = await makeUser("organizer@example.com");
    const swimmer = await makeUser("swimmer@example.com");
    const one = await makeTournament(organizer.id, "One");
    const two = await makeTournament(organizer.id, "Two");
    const teamOne = await makeTeam(one.id, "A");

    const mismatched = db.teamMember.create({
      data: { teamId: teamOne.id, tournamentId: two.id, userId: swimmer.id },
    });

    await expect(mismatched).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });
});
