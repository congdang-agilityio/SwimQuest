import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { getMySwim, InvalidCursorError, listMySwims } from "./my-swims";

async function clean() {
  await db.xpEntry.deleteMany();
  await db.pointsEntry.deleteMany();
  await db.swimResult.deleteMany();
  await db.swim.deleteMany();
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}

beforeEach(clean);
afterAll(clean);

const user = (n: string) =>
  db.user.create({ data: { email: `${n}@example.com`, passwordHash: "h", displayName: n } });

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

const swim = (userId: string, startedAt: Date, distanceM = 1000) =>
  db.swim.create({
    data: {
      userId,
      source: "FIT",
      fileSha256: "f".repeat(64),
      originalFilename: "swim.fit",
      startedAt,
      endedAt: new Date(startedAt.getTime() + 2700_000),
      distanceM,
      durationS: 2700,
      swimType: "POOL",
      sport: "swimming",
      isSwim: true,
      track: [{ lat: 10, lon: 106 }],
    },
  });

describe("listMySwims", () => {
  it("lists only my swims, newest first, without the track", async () => {
    const me = await user("me");
    const other = await user("other");
    const older = await swim(me.id, new Date("2026-06-01T06:00:00+07:00"), 800);
    const newer = await swim(me.id, new Date("2026-06-02T06:00:00+07:00"), 1200);
    await swim(other.id, new Date("2026-06-03T06:00:00+07:00"));

    const page = await listMySwims(me.id);

    expect(page.nextCursor).toBeNull();
    expect(page.items).toEqual([
      { id: newer.id, startedAt: newer.startedAt.toISOString(), distanceM: 1200, durationS: 2700 },
      { id: older.id, startedAt: older.startedAt.toISOString(), distanceM: 800, durationS: 2700 },
    ]);
    expect(JSON.stringify(page)).not.toContain("track");
  });

  it("pages through 25 swims (some at the same start) without gaps or repeats", async () => {
    const me = await user("me");
    const base = new Date("2026-06-01T06:00:00+07:00").getTime();
    const created = [];
    for (let i = 0; i < 25; i++) {
      // Pairs share a start time so the id tie-breaker is exercised.
      created.push(await swim(me.id, new Date(base + Math.floor(i / 2) * 3600_000)));
    }

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page = await listMySwims(me.id, { cursor: cursor ?? undefined, limit: 10 });
      seen.push(...page.items.map((s) => s.id));
      cursor = page.nextCursor;
      pages++;
    } while (cursor && pages < 10);

    expect(pages).toBe(3);
    expect(seen).toHaveLength(25);
    expect(new Set(seen).size).toBe(25);
    const expected = [...created]
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime() || (a.id < b.id ? 1 : -1))
      .map((s) => s.id);
    expect(seen).toEqual(expected);
  });

  it("uses a page size of 20 by default", async () => {
    const me = await user("me");
    const base = new Date("2026-06-01T06:00:00+07:00").getTime();
    for (let i = 0; i < 21; i++) await swim(me.id, new Date(base + i * 60_000));

    const first = await listMySwims(me.id);
    expect(first.items).toHaveLength(20);
    const second = await listMySwims(me.id, { cursor: first.nextCursor! });
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
  });

  it("rejects a bad cursor or limit", async () => {
    const me = await user("me");
    await expect(listMySwims(me.id, { cursor: "not-a-cursor" })).rejects.toBeInstanceOf(
      InvalidCursorError,
    );
    await expect(listMySwims(me.id, { limit: 0 })).rejects.toThrow();
    await expect(listMySwims(me.id, { limit: 1000 })).rejects.toThrow();
  });
});

describe("getMySwim", () => {
  it("shows the status, reasons and points of the swim in each tournament", async () => {
    const me = await user("me");
    const a = await tournamentWith(me.id, "Alpha");
    const b = await tournamentWith(me.id, "Beta");
    const s = await swim(me.id, new Date("2026-06-01T06:00:00+07:00"));
    const ra = await db.swimResult.create({
      data: {
        swimId: s.id,
        tournamentId: a.t.id,
        teamId: a.team.id,
        userId: me.id,
        status: "VERIFIED",
        reasons: [],
        countedM: 1000,
      },
    });
    await db.swimResult.create({
      data: {
        swimId: s.id,
        tournamentId: b.t.id,
        teamId: b.team.id,
        userId: me.id,
        status: "RULE_MISSED",
        reasons: ["PACE_TOO_SLOW"],
      },
    });
    const entry = { tournamentId: a.t.id, userId: me.id, teamId: a.team.id, vnDay: "2026-06-01" };
    await db.pointsEntry.create({
      data: { ...entry, swimResultId: ra.id, kind: "DISTANCE", points: 10, countedM: 1000 },
    });
    await db.pointsEntry.create({
      data: { ...entry, swimResultId: ra.id, kind: "FIRST_SWIM_BONUS", points: 20 },
    });

    const dto = await getMySwim(me.id, s.id);

    expect(dto?.id).toBe(s.id);
    expect(dto?.distanceM).toBe(1000);
    expect(
      dto?.results.map(({ tournamentName, status, displayStatus, reasons, points }) => ({
        tournamentName,
        status,
        displayStatus,
        reasons,
        points,
      })),
    ).toEqual([
      {
        tournamentName: "Alpha",
        status: "VERIFIED",
        displayStatus: "verified",
        reasons: [],
        points: { distance: 10, firstSwimBonus: 20, longSwimBonus: 0, reversal: 0, total: 30 },
      },
      {
        tournamentName: "Beta",
        status: "RULE_MISSED",
        displayStatus: "ruleMissed",
        reasons: ["PACE_TOO_SLOW"],
        points: { distance: 0, firstSwimBonus: 0, longSwimBonus: 0, reversal: 0, total: 0 },
      },
    ]);
    expect(JSON.stringify(dto)).not.toContain("track");
    expect(JSON.stringify(dto)).not.toContain("lat");
  });

  it("splits a 3.2 km first swim into distance 32, first-swim +20, long-swim +25, total 77", async () => {
    const me = await user("me");
    const a = await tournamentWith(me.id, "Alpha");
    const s = await swim(me.id, new Date("2026-06-01T06:00:00+07:00"));
    const ra = await db.swimResult.create({
      data: {
        swimId: s.id,
        tournamentId: a.t.id,
        teamId: a.team.id,
        userId: me.id,
        status: "VERIFIED",
        reasons: [],
        countedM: 3200,
      },
    });
    const entry = { tournamentId: a.t.id, userId: me.id, teamId: a.team.id, vnDay: "2026-06-01" };
    for (const [kind, points] of [
      ["DISTANCE", 32],
      ["FIRST_SWIM_BONUS", 20],
      ["LONG_SWIM_BONUS", 25],
    ] as const) {
      await db.pointsEntry.create({ data: { ...entry, swimResultId: ra.id, kind, points } });
    }
    const dto = await getMySwim(me.id, s.id);
    expect(dto?.results[0].points).toEqual({
      distance: 32,
      firstSwimBonus: 20,
      longSwimBonus: 25,
      reversal: 0,
      total: 77,
    });
  });

  it("shows a revoked swim's reversal and puts reversal and weekly entries in the total", async () => {
    const me = await user("me");
    const a = await tournamentWith(me.id, "Alpha");
    const s = await swim(me.id, new Date("2026-06-01T06:00:00+07:00"));
    const ra = await db.swimResult.create({
      data: {
        swimId: s.id,
        tournamentId: a.t.id,
        teamId: a.team.id,
        userId: me.id,
        status: "REVOKED",
        reasons: [],
        countedM: 3200,
      },
    });
    const entry = { tournamentId: a.t.id, userId: me.id, teamId: a.team.id, vnDay: "2026-06-01" };
    for (const [kind, points] of [
      ["DISTANCE", 32],
      ["FIRST_SWIM_BONUS", 20],
      ["WEEKLY_MULTIPLIER", 3],
      ["REVERSAL", -52],
    ] as const) {
      await db.pointsEntry.create({ data: { ...entry, swimResultId: ra.id, kind, points } });
    }
    const dto = await getMySwim(me.id, s.id);
    expect(dto?.results[0].points).toEqual({
      distance: 32,
      firstSwimBonus: 20,
      longSwimBonus: 0,
      reversal: -52,
      total: 3,
    });
  });

  it("returns null for another player's swim and for an unknown id", async () => {
    const me = await user("me");
    const other = await user("other");
    const theirs = await swim(other.id, new Date("2026-06-01T06:00:00+07:00"));

    expect(await getMySwim(me.id, theirs.id)).toBeNull();
    expect(await getMySwim(me.id, "no-such-swim")).toBeNull();
    expect(await getMySwim(me.id, "")).toBeNull();
  });
});
