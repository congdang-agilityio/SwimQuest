import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError, NotFoundError } from "@/server/auth/roles";
import { db } from "@/server/db";
import { chooseStart, getTeamStart, InvalidStartError } from "./choose-start";

async function clean() {
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.auditEvent.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}

const user = (n: string) =>
  db.user.create({ data: { email: `${n}@example.com`, passwordHash: "h", displayName: n } });

async function setup() {
  const organizer = await user("organizer");
  const captain = await user("captain");
  const member = await user("member");
  const tournament = await db.tournament.create({
    data: {
      organizerId: organizer.id,
      name: "Cup",
      description: "d",
      seasonStartAt: new Date("2026-11-01T00:00:00+07:00"),
      seasonEndAt: new Date("2026-12-01T00:00:00+07:00"),
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
});
