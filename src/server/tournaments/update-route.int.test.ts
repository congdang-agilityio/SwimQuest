import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError } from "@/server/auth/roles";
import { updateRoute } from "./update-route";

const SEASON_START = new Date("2026-11-01T06:00:00+07:00");
const BEFORE = new Date("2026-11-01T05:59:59.999+07:00");
/** A stored route id (seeded directly), so a change to "route01" is visible. */
const OLD_ROUTE = "route00";

async function makeUser(email: string) {
  return db.user.create({ data: { email, passwordHash: "hash", displayName: email } });
}

async function makeTournament(organizerId: string) {
  return db.tournament.create({
    data: {
      organizerId,
      status: "PUBLISHED",
      name: "Autumn Expedition",
      description: "Swim to Ly Son together",
      seasonStartAt: SEASON_START,
      seasonEndAt: new Date("2026-11-30T23:59:00+07:00"),
      routeId: OLD_ROUTE,
      routeDistanceM: 123_450,
      fastestPaceSecPer100m: 65,
      slowestPaceSecPer100m: 300,
      longestRealisticSwimM: 30_000,
      longestSwimCountedM: 10_000,
      dailyLimitM: 10_000,
      pointsPerKm: 10,
    },
  });
}

async function clean() {
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
  await db.session.deleteMany();
  await db.user.deleteMany();
}

const stored = (id: string) =>
  db.tournament.findUniqueOrThrow({
    where: { id },
    select: { routeId: true, routeDistanceM: true },
  });

describe("updateRoute", () => {
  beforeEach(clean);
  afterEach(() => vi.restoreAllMocks());

  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("changes the route and distance before the season starts", async () => {
    const user = await makeUser("organizer@example.com");
    const t = await makeTournament(user.id);

    const result = await updateRoute(
      user.id,
      t.id,
      { routeId: "route01", routeDistanceKm: "80.5" },
      BEFORE,
    );

    expect(result).toEqual({
      ok: true,
      tournament: { id: t.id, routeId: "route01", routeDistanceM: 80_500 },
    });
    await expect(stored(t.id)).resolves.toEqual({ routeId: "route01", routeDistanceM: 80_500 });
  });

  it("changes only the field that is sent", async () => {
    const user = await makeUser("organizer@example.com");
    const t = await makeTournament(user.id);

    const result = await updateRoute(user.id, t.id, { routeDistanceKm: 99 }, BEFORE);

    expect(result.ok).toBe(true);
    await expect(stored(t.id)).resolves.toEqual({ routeId: OLD_ROUTE, routeDistanceM: 99_000 });
  });

  it("refuses with ROUTE_LOCKED from the season start and changes nothing", async () => {
    const user = await makeUser("organizer@example.com");
    const t = await makeTournament(user.id);

    for (const now of [SEASON_START, new Date("2026-11-15T12:00:00+07:00")]) {
      const result = await updateRoute(
        user.id,
        t.id,
        { routeId: "route01", routeDistanceKm: 50 },
        now,
      );
      expect(result).toEqual({ ok: false, reason: "ROUTE_LOCKED" });
    }
    await expect(stored(t.id)).resolves.toEqual({ routeId: OLD_ROUTE, routeDistanceM: 123_450 });
  });

  it("refuses with ROUTE_LOCKED when the season start moved after it was read", async () => {
    const user = await makeUser("organizer@example.com");
    const t = await makeTournament(user.id);
    // The guard reads the old season start; the stored one moved to `now` in between.
    vi.spyOn(db.tournament, "findUnique").mockResolvedValueOnce(t as never);
    await db.tournament.update({ where: { id: t.id }, data: { seasonStartAt: BEFORE } });

    const result = await updateRoute(user.id, t.id, { routeDistanceKm: 50 }, BEFORE);

    expect(result).toEqual({ ok: false, reason: "ROUTE_LOCKED" });
    await expect(stored(t.id)).resolves.toEqual({ routeId: OLD_ROUTE, routeDistanceM: 123_450 });
  });

  it("refuses a non-organizer and a missing tournament", async () => {
    const organizer = await makeUser("organizer@example.com");
    const other = await makeUser("other@example.com");
    const t = await makeTournament(organizer.id);

    await expect(updateRoute(other.id, t.id, { routeDistanceKm: 50 }, BEFORE)).rejects.toThrow(
      ForbiddenError,
    );
    await expect(
      updateRoute(organizer.id, "missing", { routeDistanceKm: 50 }, BEFORE),
    ).rejects.toThrow(NotFoundError);
    await expect(stored(t.id)).resolves.toEqual({ routeId: OLD_ROUTE, routeDistanceM: 123_450 });
  });

  it("validates like creation and changes nothing for invalid input", async () => {
    const user = await makeUser("organizer@example.com");
    const t = await makeTournament(user.id);

    const cases: [unknown, Record<string, string>][] = [
      [{ routeDistanceKm: "-3" }, { routeDistanceKm: "ROUTE_DISTANCE_NOT_POSITIVE" }],
      [{ routeDistanceKm: "1.234" }, { routeDistanceKm: "ROUTE_DISTANCE_TOO_PRECISE" }],
      [{ routeDistanceKm: "abc" }, { routeDistanceKm: "ROUTE_DISTANCE_INVALID" }],
      [{ routeDistanceKm: null }, { routeDistanceKm: "ROUTE_DISTANCE_REQUIRED" }],
      [{ routeId: "nope" }, { routeId: "ROUTE_UNKNOWN" }],
      [{ routeId: "route01", name: "x" }, { name: "UNKNOWN_FIELD" }],
      [{}, { body: "NO_ROUTE_CHANGE" }],
      [null, { body: "NO_ROUTE_CHANGE" }],
      [["route01"], { body: "NO_ROUTE_CHANGE" }],
    ];
    for (const [input, errors] of cases) {
      const result = await updateRoute(user.id, t.id, input, BEFORE);
      expect(result).toEqual({ ok: false, reason: "INVALID", errors });
    }
    await expect(stored(t.id)).resolves.toEqual({ routeId: OLD_ROUTE, routeDistanceM: 123_450 });
  });
});
