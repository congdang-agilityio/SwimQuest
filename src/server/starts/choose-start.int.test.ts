import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError, NotFoundError } from "@/server/auth/roles";
import { db } from "@/server/db";
import { chooseStart, getTeamStart, InvalidStartError, StartLockedError } from "./choose-start";

async function clean() {
  await db.domainEvent.deleteMany();
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
  await db.session.deleteMany();
  await db.xpEntry.deleteMany();
  await db.user.deleteMany();
}

const user = (n: string) =>
  db.user.create({ data: { email: `${n}@example.com`, passwordHash: "h", displayName: n } });

// Far from the real clock, so the tests without an injected clock never reach the lock.
const SEASON_START = new Date("2099-11-01T06:00:00+07:00");

async function setup(dates: { startChoiceDeadlineAt?: Date } = {}) {
  const organizer = await user("organizer");
  const captain = await user("captain");
  const member = await user("member");
  const tournament = await db.tournament.create({
    data: {
      organizerId: organizer.id,
      name: "Cup",
      description: "d",
      seasonStartAt: SEASON_START,
      seasonEndAt: new Date("2099-12-01T00:00:00+07:00"),
      startChoiceDeadlineAt: dates.startChoiceDeadlineAt ?? null,
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
  for (const u of [captain, member]) {
    await db.teamMember.create({
      data: { tournamentId: tournament.id, teamId: team.id, userId: u.id },
    });
  }
  return { organizer, captain, member, tournament, team };
}

const stored = (teamId: string) =>
  db.team.findUniqueOrThrow({
    where: { id: teamId },
    select: { startDestination: true, startSetAt: true, startSetBy: true },
  });

describe("chooseStart / getTeamStart", () => {
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("reports no start for a new team", async () => {
    const { team } = await setup();
    expect(await getTeamStart(team.id)).toEqual({ slug: null, setAt: null, setBy: null });
  });

  it("emits one TEAM_START_SET per change, none for the same slug", async () => {
    const { captain, team, tournament } = await setup();
    await chooseStart(captain.id, team.id, "non_nuoc");
    await chooseStart(captain.id, team.id, "non_nuoc");

    const events = await db.domainEvent.findMany({ where: { type: "TEAM_START_SET" } });
    expect(events).toHaveLength(1);
    expect(events[0].payload).toEqual({
      tournamentId: tournament.id,
      teamId: team.id,
      startId: "non_nuoc",
      setBy: captain.id,
    });
  });

  it("lets the captain choose a start", async () => {
    const { captain, team } = await setup();
    const before = Date.now();
    const result = await chooseStart(captain.id, team.id, "non_nuoc");
    expect(result.changed).toBe(true);
    expect(result.start).toMatchObject({ slug: "non_nuoc", setBy: "CAPTAIN" });
    const row = await stored(team.id);
    expect(row).toMatchObject({ startDestination: "non_nuoc", startSetBy: "CAPTAIN" });
    expect(row.startSetAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(await getTeamStart(team.id)).toEqual({
      slug: "non_nuoc",
      setAt: row.startSetAt,
      setBy: "CAPTAIN",
    });
  });

  it("accepts each of the six start destinations", async () => {
    const { captain, team } = await setup();
    for (const slug of [
      "non_nuoc",
      "son_thuy",
      "pham_van_dong",
      "man_thai",
      "hon_sup",
      "cu_lao_cham",
    ]) {
      await chooseStart(captain.id, team.id, slug);
      expect((await getTeamStart(team.id)).slug).toBe(slug);
    }
  });

  it("lets the captain change the start", async () => {
    const { captain, team } = await setup();
    await chooseStart(captain.id, team.id, "non_nuoc");
    const result = await chooseStart(captain.id, team.id, "hon_sup");
    expect(result.changed).toBe(true);
    expect((await stored(team.id)).startDestination).toBe("hon_sup");
  });

  it("does not write when the captain repeats the same start", async () => {
    const { captain, team } = await setup();
    await chooseStart(captain.id, team.id, "man_thai");
    const first = await stored(team.id);
    const result = await chooseStart(captain.id, team.id, "man_thai");
    expect(result).toEqual({
      changed: false,
      start: { slug: "man_thai", setAt: first.startSetAt, setBy: "CAPTAIN" },
    });
    expect(await stored(team.id)).toEqual(first);
  });

  it("refuses a team member who is not the captain", async () => {
    const { member, team } = await setup();
    await expect(chooseStart(member.id, team.id, "non_nuoc")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect((await stored(team.id)).startDestination).toBeNull();
  });

  it("refuses the finish (Lý Sơn) and unknown or malformed slugs", async () => {
    const { captain, team } = await setup();
    for (const slug of ["ly_son", "da_nang", "", 42, null]) {
      await expect(chooseStart(captain.id, team.id, slug)).rejects.toBeInstanceOf(
        InvalidStartError,
      );
    }
    expect((await stored(team.id)).startDestination).toBeNull();
    const err = await chooseStart(captain.id, team.id, "ly_son").catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "INVALID_START" });
  });

  it("refuses an unknown team", async () => {
    const { captain } = await setup();
    await expect(chooseStart(captain.id, "missing", "non_nuoc")).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(getTeamStart("missing")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("keeps one consistent start when the captain chooses concurrently", async () => {
    const { captain, team } = await setup();
    const results = await Promise.all([
      chooseStart(captain.id, team.id, "son_thuy"),
      chooseStart(captain.id, team.id, "son_thuy"),
    ]);
    expect(results.filter((r) => r.changed)).toHaveLength(1);
    expect((await stored(team.id)).startDestination).toBe("son_thuy");
  });

  describe("after the start-choice lock", () => {
    const justBefore = new Date(SEASON_START.getTime() - 1000);

    const setStart = (teamId: string, slug: string, setBy: "CAPTAIN" | "AUTOMATIC") =>
      db.team.update({
        where: { id: teamId },
        data: {
          startDestination: slug,
          startSetAt: new Date("2099-10-01T00:00:00Z"),
          startSetBy: setBy,
        },
      });

    it("still allows a change one second before the deadline", async () => {
      const { captain, team } = await setup();
      await setStart(team.id, "non_nuoc", "CAPTAIN");
      const result = await chooseStart(captain.id, team.id, "hon_sup", justBefore);
      expect(result.changed).toBe(true);
      expect((await stored(team.id)).startDestination).toBe("hon_sup");
    });

    for (const setBy of ["CAPTAIN", "AUTOMATIC"] as const) {
      it(`refuses a different start exactly at the deadline (start set by ${setBy})`, async () => {
        const { captain, team } = await setup();
        await setStart(team.id, "non_nuoc", setBy);
        const before = await stored(team.id);
        const err = await chooseStart(captain.id, team.id, "hon_sup", SEASON_START).catch(
          (e: unknown) => e,
        );
        expect(err).toBeInstanceOf(StartLockedError);
        expect(err).toMatchObject({ status: 409, code: "START_LOCKED", lockedAt: SEASON_START });
        expect(await stored(team.id)).toEqual(before);
      });

      it(`accepts the same start at the deadline without writing (start set by ${setBy})`, async () => {
        const { captain, team } = await setup();
        await setStart(team.id, "non_nuoc", setBy);
        const before = await stored(team.id);
        const result = await chooseStart(captain.id, team.id, "non_nuoc", SEASON_START);
        expect(result).toEqual({
          changed: false,
          start: { slug: "non_nuoc", setAt: before.startSetAt, setBy },
        });
        expect(await stored(team.id)).toEqual(before);
      });
    }

    it("refuses a first start once locked and writes nothing", async () => {
      const { captain, team } = await setup();
      await expect(
        chooseStart(captain.id, team.id, "non_nuoc", SEASON_START),
      ).rejects.toBeInstanceOf(StartLockedError);
      expect((await stored(team.id)).startDestination).toBeNull();
    });

    it("locks at the start-choice deadline when it is set before the season start", async () => {
      const deadline = new Date("2099-10-30T12:00:00+07:00");
      const { captain, team } = await setup({ startChoiceDeadlineAt: deadline });
      await setStart(team.id, "non_nuoc", "CAPTAIN");
      const ok = await chooseStart(
        captain.id,
        team.id,
        "son_thuy",
        new Date(deadline.getTime() - 1000),
      );
      expect(ok.changed).toBe(true);
      const err = await chooseStart(captain.id, team.id, "hon_sup", deadline).catch(
        (e: unknown) => e,
      );
      expect(err).toMatchObject({ code: "START_LOCKED", lockedAt: deadline });
      expect((await stored(team.id)).startDestination).toBe("son_thuy");
    });
  });
});
