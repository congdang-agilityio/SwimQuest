import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { createSwimFromUpload } from "@/server/swims/create-from-upload";
import { buildFit } from "@/server/swims/parse/__tests__/fit-builder";
import { awardDistancePoints } from "./award-distance-points";

async function clean() {
  await db.pointsEntry.deleteMany();
  await db.swimResult.deleteMany();
  await db.swim.deleteMany();
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}

const user = (n: string) =>
  db.user.create({ data: { email: `${n}@example.com`, passwordHash: "h", displayName: n } });

/** A published tournament (1 May to 1 July 2026, Vietnam time, default settings) with `userId`. */
async function tournamentWith(userId: string, name: string) {
  const org = await user(`org-${name}`);
  const t = await db.tournament.create({
    data: {
      organizerId: org.id,
      name,
      description: "d",
      status: "PUBLISHED",
      seasonStartAt: new Date("2026-05-01T06:00:00+07:00"),
      seasonEndAt: new Date("2026-07-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100000,
    },
  });
  const team = await db.team.create({
    data: { tournamentId: t.id, name: `${name}-team`, emblemKey: "dolphin", memberLimit: 5 },
  });
  await db.teamMember.create({ data: { tournamentId: t.id, teamId: team.id, userId } });
  return { t, team };
}

let sha = 0;
/** A stored swim of `distanceM` metres starting at `startedAt`. */
function swim(userId: string, distanceM: number, startedAt: string) {
  const start = new Date(startedAt);
  return db.swim.create({
    data: {
      userId,
      source: "FIT",
      fileSha256: (++sha).toString(16).padStart(64, "0"),
      originalFilename: "swim.fit",
      startedAt: start,
      endedAt: new Date(start.getTime() + 3600_000),
      distanceM,
      durationS: 3600,
      swimType: "POOL",
      sport: "swimming",
      isSwim: true,
    },
  });
}

type Fixture = Awaited<ReturnType<typeof tournamentWith>>;

/** A VERIFIED result for a new swim in the fixture's tournament. */
async function verified(userId: string, f: Fixture, distanceM: number, startedAt: string) {
  const s = await swim(userId, distanceM, startedAt);
  return db.swimResult.create({
    data: {
      swimId: s.id,
      tournamentId: f.t.id,
      teamId: f.team.id,
      userId,
      status: "VERIFIED",
      reasons: [],
    },
  });
}

type Result = Awaited<ReturnType<typeof verified>>;
const award = (result: Result) => db.$transaction((tx) => awardDistancePoints(tx, result));
const entriesOf = (swimResultId: string) => db.pointsEntry.findMany({ where: { swimResultId } });

describe("awardDistancePoints", () => {
  beforeEach(async () => {
    // The seasons are in 2026; pin the clock inside them so tests do not rot.
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-06-01T00:00:00+07:00") });
    await clean();
  });
  afterEach(() => vi.useRealTimers());
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("gives 24 points for a verified 2,450 m swim and records the counted metres", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "One");
    const r = await verified(me.id, f, 2450, "2026-06-01T06:00:00+07:00");

    await award(r);

    expect(await entriesOf(r.id)).toEqual([
      expect.objectContaining({
        tournamentId: f.t.id,
        teamId: f.team.id,
        userId: me.id,
        kind: "DISTANCE",
        points: 24,
        countedM: 2450,
        vnDay: "2026-06-01",
      }),
    ]);
    expect((await db.swimResult.findUniqueOrThrow({ where: { id: r.id } })).countedM).toBe(2450);
  });

  it("counts only 10 km of a 12 km swim", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "One");
    const r = await verified(me.id, f, 12_000, "2026-06-01T06:00:00+07:00");

    await award(r);

    expect(await entriesOf(r.id)).toEqual([
      expect.objectContaining({ points: 100, countedM: 10_000 }),
    ]);
  });

  it("adds only 2 km and 20 points when 8 km already counted that Vietnam day", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "One");
    await award(await verified(me.id, f, 8000, "2026-06-01T06:00:00+07:00"));
    const r = await verified(me.id, f, 4000, "2026-06-01T18:00:00+07:00");

    await award(r);

    expect(await entriesOf(r.id)).toEqual([
      expect.objectContaining({ points: 20, countedM: 2000, vnDay: "2026-06-01" }),
    ]);
    expect((await db.swimResult.findUniqueOrThrow({ where: { id: r.id } })).countedM).toBe(2000);
  });

  it("puts swims at 23:30 and 00:30 Vietnam time on different days", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "One");
    const late = await verified(me.id, f, 10_000, "2026-06-01T23:30:00+07:00");
    const early = await verified(me.id, f, 5000, "2026-06-02T00:30:00+07:00");

    await award(late);
    await award(early);

    expect(await entriesOf(late.id)).toEqual([
      expect.objectContaining({ countedM: 10_000, vnDay: "2026-06-01" }),
    ]);
    expect(await entriesOf(early.id)).toEqual([
      expect.objectContaining({ countedM: 5000, points: 50, vnDay: "2026-06-02" }),
    ]);
  });

  it("is idempotent: a second call for the same result inserts nothing", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "One");
    const r = await verified(me.id, f, 2450, "2026-06-01T06:00:00+07:00");

    await award(r);
    await award(r);

    expect(await entriesOf(r.id)).toHaveLength(1);
  });

  it("gives nothing for a result that is not verified", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "One");
    const r = await verified(me.id, f, 2450, "2026-06-01T06:00:00+07:00");
    const flagged = await db.swimResult.update({
      where: { id: r.id },
      data: { status: "FLAGGED" },
    });

    await award(flagged);

    expect(await db.pointsEntry.count()).toBe(0);
  });

  it("never lets concurrent awards on the same day exceed the daily limit", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "One");
    const results: Result[] = [];
    for (let h = 6; h < 11; h++) {
      results.push(
        await verified(me.id, f, 4000, `2026-06-01T${h.toString().padStart(2, "0")}:00:00+07:00`),
      );
    }

    await Promise.all(results.map(award));

    const sum = await db.pointsEntry.aggregate({
      where: { userId: me.id, tournamentId: f.t.id, vnDay: "2026-06-01" },
      _sum: { countedM: true, points: true },
      _count: true,
    });
    expect(sum).toMatchObject({ _count: 5, _sum: { countedM: 10_000, points: 100 } });
  });

  it("awards a swim verified in two tournaments once in each, through the upload", async () => {
    const me = await user("me");
    const one = await tournamentWith(me.id, "One");
    const two = await tournamentWith(me.id, "Two");
    const file = buildFit({
      sport: 5,
      subSport: 17,
      start: new Date("2026-06-01T06:00:00+07:00"),
      timerS: 2700,
      distanceM: 2450,
    });

    const s = await createSwimFromUpload(me.id, { buffer: file, filename: "swim.fit" });

    const entries = await db.pointsEntry.findMany({ where: { swimResult: { swimId: s.id } } });
    expect(entries).toHaveLength(2);
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tournamentId: one.t.id, teamId: one.team.id, points: 24 }),
        expect.objectContaining({ tournamentId: two.t.id, teamId: two.team.id, points: 24 }),
      ]),
    );
  });
});
