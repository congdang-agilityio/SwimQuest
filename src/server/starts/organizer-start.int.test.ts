import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError, NotFoundError } from "@/server/auth/roles";
import { db } from "@/server/db";
import { assignMissingStarts } from "./auto-assign";
import { chooseStart, InvalidStartError, StartLockedError } from "./choose-start";
import { organizerSetStart } from "./organizer-start";

async function clean() {
  await db.domainEvent.deleteMany();
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
  await db.notification.deleteMany();
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.session.deleteMany();
  await db.xpEntry.deleteMany();
  await db.user.deleteMany();
}

const user = (n: string) =>
  db.user.create({ data: { email: `${n}@example.com`, passwordHash: "h", displayName: n } });

const SEASON_START = new Date("2099-11-01T06:00:00+07:00");
const BEFORE_LOCK = new Date("2099-10-15T00:00:00Z");

async function setup() {
  const organizer = await user("organizer");
  const captain = await user("captain");
  const tournament = await db.tournament.create({
    data: {
      organizerId: organizer.id,
      status: "PUBLISHED",
      name: "Cup",
      description: "d",
      seasonStartAt: SEASON_START,
      seasonEndAt: new Date("2099-12-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100000,
    },
  });
  const team = await db.team.create({
    data: {
      tournamentId: tournament.id,
      name: "Sharks",
      emblemKey: "dolphin",
      memberLimit: 5,
      captainUserId: captain.id,
    },
  });
  await db.teamMember.create({
    data: { tournamentId: tournament.id, teamId: team.id, userId: captain.id },
  });
  return { organizer, captain, tournament, team };
}

const stored = (teamId: string) =>
  db.team.findUniqueOrThrow({
    where: { id: teamId },
    select: { startDestination: true, startSetAt: true, startSetBy: true },
  });

describe("organizerSetStart", () => {
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("sets the start of a team without one", async () => {
    const { organizer, team } = await setup();
    const result = await organizerSetStart(organizer.id, team.id, "non_nuoc", BEFORE_LOCK);
    expect(result).toEqual({
      changed: true,
      start: { slug: "non_nuoc", setAt: BEFORE_LOCK, setBy: "ORGANIZER" },
    });
    expect(await stored(team.id)).toEqual({
      startDestination: "non_nuoc",
      startSetAt: BEFORE_LOCK,
      startSetBy: "ORGANIZER",
    });
  });

  it("overrides the captain's choice", async () => {
    const { organizer, captain, team } = await setup();
    await chooseStart(captain.id, team.id, "son_thuy", BEFORE_LOCK);
    await organizerSetStart(organizer.id, team.id, "man_thai", BEFORE_LOCK);
    expect(await stored(team.id)).toMatchObject({
      startDestination: "man_thai",
      startSetBy: "ORGANIZER",
    });
  });

  it("audits who set it with the old and new start", async () => {
    const { organizer, captain, team, tournament } = await setup();
    await chooseStart(captain.id, team.id, "son_thuy", BEFORE_LOCK);
    await organizerSetStart(organizer.id, team.id, "man_thai", BEFORE_LOCK);

    const events = await db.auditEvent.findMany();
    expect(events).toHaveLength(1);
    const ids = { teamId: team.id, tournamentId: tournament.id };
    expect(events[0]).toMatchObject({
      actorType: "USER",
      actorUserId: organizer.id,
      action: "TEAM_START_SET_BY_ORGANIZER",
      entityType: "Team",
      entityId: team.id,
      tournamentId: tournament.id,
      before: { ...ids, startDestination: "son_thuy", startSetBy: "CAPTAIN" },
      after: {
        ...ids,
        startDestination: "man_thai",
        startSetAt: BEFORE_LOCK.toISOString(),
        startSetBy: "ORGANIZER",
      },
    });
  });

  it("emits one TEAM_START_SET per change, none for the same start", async () => {
    const { organizer, team, tournament } = await setup();
    await organizerSetStart(organizer.id, team.id, "hon_sup", BEFORE_LOCK);
    const again = await organizerSetStart(organizer.id, team.id, "hon_sup", BEFORE_LOCK);
    expect(again.changed).toBe(false);

    const events = await db.domainEvent.findMany({ where: { type: "TEAM_START_SET" } });
    expect(events).toHaveLength(1);
    expect(events[0].payload).toEqual({
      tournamentId: tournament.id,
      teamId: team.id,
      startId: "hon_sup",
      setBy: organizer.id,
    });
    expect(await db.auditEvent.count()).toBe(1);
  });

  it("refuses a change at or after the lock, also for an automatically assigned start", async () => {
    const { organizer, team } = await setup();
    await expect(
      organizerSetStart(organizer.id, team.id, "non_nuoc", SEASON_START),
    ).rejects.toEqual(new StartLockedError(SEASON_START));
    expect((await stored(team.id)).startDestination).toBeNull();

    const [assigned] = await assignMissingStarts(team.tournamentId, SEASON_START);
    const other = assigned.slug === "non_nuoc" ? "son_thuy" : "non_nuoc";
    const later = new Date(SEASON_START.getTime() + 60000);
    const err = await organizerSetStart(organizer.id, team.id, other, later).catch((e) => e);
    expect(err).toBeInstanceOf(StartLockedError);
    expect(err.code).toBe("START_LOCKED");
    expect(await stored(team.id)).toMatchObject({
      startDestination: assigned.slug,
      startSetBy: "AUTOMATIC",
    });
    expect(await db.auditEvent.count({ where: { action: "TEAM_START_SET_BY_ORGANIZER" } })).toBe(0);
  });

  it("refuses a user who is not the organizer, and an unknown team", async () => {
    const { captain, team } = await setup();
    await expect(organizerSetStart(captain.id, team.id, "non_nuoc", BEFORE_LOCK)).rejects.toThrow(
      ForbiddenError,
    );
    await expect(organizerSetStart(captain.id, "missing", "non_nuoc", BEFORE_LOCK)).rejects.toThrow(
      NotFoundError,
    );
    expect((await stored(team.id)).startDestination).toBeNull();
    expect(await db.auditEvent.count()).toBe(0);
  });

  it("refuses the finish or an unknown start", async () => {
    const { organizer, team } = await setup();
    for (const slug of ["ly_son", "nowhere", 42, null]) {
      await expect(organizerSetStart(organizer.id, team.id, slug, BEFORE_LOCK)).rejects.toThrow(
        InvalidStartError,
      );
    }
    expect((await stored(team.id)).startDestination).toBeNull();
  });

  it("makes the team no longer due for automatic assignment", async () => {
    const { organizer, team } = await setup();
    await organizerSetStart(organizer.id, team.id, "cu_lao_cham", BEFORE_LOCK);
    expect(await assignMissingStarts(team.tournamentId, SEASON_START)).toEqual([]);
    expect(await stored(team.id)).toMatchObject({
      startDestination: "cu_lao_cham",
      startSetBy: "ORGANIZER",
    });
  });
});
