import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { runDueWeekSettlements } from "@/server/jobs/tick";
import { onVerified } from "./on-verified";
import { endedSeasonWeeks, recalculatePlayerWeek, settleWeek } from "./settle-week";

async function clean() {
  await db.domainEvent.deleteMany();
  await db.auditEvent.deleteMany();
  await db.notification.deleteMany();
  await db.pushSubscription.deleteMany();
  await db.zaloSwimPost.deleteMany();
  await db.zaloMessage.deleteMany();
  await db.tournamentZalo.deleteMany();
  await db.zaloBot.deleteMany();
  await db.weeklyResult.deleteMany();
  await db.weekSettlement.deleteMany();
  await db.pointsEntry.deleteMany();
  await db.swimResult.deleteMany();
  await db.swim.deleteMany();
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}

let n = 0;
const user = (name: string) =>
  db.user.create({
    data: { email: `${name}${++n}@example.com`, passwordHash: "h", displayName: name },
  });

// Weeks (Monday, Vietnam time) of the May 2026 season used below.
const W1 = "2026-05-04";
const W2 = "2026-05-11";
const SETTLE_AT = new Date("2026-08-01T00:00:00+07:00");

/** A published tournament (May to July 2026, Vietnam time) with `userId` in its one team. */
async function tournamentWith(
  userId: string,
  settings: Partial<Prisma.TournamentUncheckedCreateInput> = {},
) {
  const org = await user("org");
  const t = await db.tournament.create({
    data: {
      organizerId: org.id,
      name: "Cup",
      description: "d",
      status: "PUBLISHED",
      seasonStartAt: new Date("2026-05-01T06:00:00+07:00"),
      seasonEndAt: new Date("2026-07-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100000,
      ...settings,
    },
  });
  const team = await addTeam(t.id);
  await db.teamMember.create({
    data: { tournamentId: t.id, teamId: team.id, userId, joinedAt: new Date("2026-04-01") },
  });
  return { t, team };
}

const addTeam = (tournamentId: string) =>
  db.team.create({
    data: { tournamentId, name: `Team ${++n}`, emblemKey: "dolphin", memberLimit: 5 },
  });

let sha = 0;
/** A swim of `distanceM` at 06:00 Vietnam time on `day`, verified and scored like an upload. */
async function swim(
  userId: string,
  tournamentId: string,
  teamId: string,
  distanceM: number,
  day: string,
) {
  const start = new Date(`${day}T06:00:00+07:00`);
  const s = await db.swim.create({
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
  const result = await db.swimResult.create({
    data: { swimId: s.id, tournamentId, teamId, userId, status: "VERIFIED", reasons: [] },
  });
  await db.$transaction((tx) => onVerified(tx, result, start));
  return result;
}

/** Days (YYYY-MM-DD) of the week starting `monday`, offset by 0..6. */
const day = (monday: string, offset: number) => {
  const d = new Date(`${monday}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

const weekly = (tournamentId: string, userId: string, weekStart: string) =>
  db.weeklyResult.findUniqueOrThrow({
    where: { tournamentId_userId_weekStart: { tournamentId, userId, weekStart } },
  });
const multiplierEntries = (tournamentId: string, userId: string) =>
  db.pointsEntry.findMany({
    where: { tournamentId, userId, kind: "WEEKLY_MULTIPLIER" },
    orderBy: { createdAt: "asc" },
    select: { points: true, vnDay: true, teamId: true, swimResultId: true, countedM: true },
  });
const progressOf = async (teamId: string) =>
  (await db.team.findUniqueOrThrow({ where: { id: teamId } })).progressBp;

beforeEach(clean);
afterAll(async () => {
  await clean();
  await db.$disconnect();
});

describe("settleWeek", () => {
  it("2 active days give x1.10 on distance points only, in team points and progress", async () => {
    const me = await user("me");
    const { t, team } = await tournamentWith(me.id);
    await swim(me.id, t.id, team.id, 1000, day(W1, 0));
    await swim(me.id, t.id, team.id, 1000, day(W1, 2));
    // 20 distance points, bonuses 20 + 10 + 10 = 40: progress 60 points = 600 bp.
    expect(await progressOf(team.id)).toBe(600);

    expect(await settleWeek(t.id, W1, SETTLE_AT)).toBe(true);

    expect(await weekly(t.id, me.id, W1)).toMatchObject({
      teamId: team.id,
      activeDays: 2,
      multiplierPct: 110,
      distancePoints: 20,
      extraPoints: 2,
      streakWeeks: 0,
      settledAt: SETTLE_AT,
    });
    expect(await multiplierEntries(t.id, me.id)).toEqual([
      { points: 2, vnDay: W1, teamId: team.id, swimResultId: null, countedM: 0 },
    ]);
    expect(await progressOf(team.id)).toBe(620);
  });

  it("3 active days give x1.20, and bonuses are not multiplied", async () => {
    const me = await user("me");
    const { t, team } = await tournamentWith(me.id);
    for (const offset of [0, 3, 6]) await swim(me.id, t.id, team.id, 3000, day(W1, offset));

    await settleWeek(t.id, W1, SETTLE_AT);

    // 90 distance points x 1.20 = +18; the 95 bonus points (20 + 3 x 25) add nothing.
    expect(await weekly(t.id, me.id, W1)).toMatchObject({
      activeDays: 3,
      multiplierPct: 120,
      distancePoints: 90,
      extraPoints: 18,
      streakWeeks: 1,
    });
    expect((await multiplierEntries(t.id, me.id)).map((e) => e.points)).toEqual([18]);
  });

  it("story example: 64 distance points x 1.20 gives +13, 77 in total (Q-43 rounding)", async () => {
    const me = await user("me");
    const { t, team } = await tournamentWith(me.id);
    await swim(me.id, t.id, team.id, 3000, day(W1, 0));
    await swim(me.id, t.id, team.id, 2000, day(W1, 1));
    await swim(me.id, t.id, team.id, 1400, day(W1, 2));

    await settleWeek(t.id, W1, SETTLE_AT);

    expect(await weekly(t.id, me.id, W1)).toMatchObject({ distancePoints: 64, extraPoints: 13 });
    expect((await multiplierEntries(t.id, me.id)).map((e) => e.points)).toEqual([13]);
  });

  it("counts an active day only for a swim of 500 m or more, once per Vietnam day", async () => {
    const me = await user("me");
    const { t, team } = await tournamentWith(me.id);
    await swim(me.id, t.id, team.id, 1000, day(W1, 0));
    await swim(me.id, t.id, team.id, 1000, day(W1, 0));
    await swim(me.id, t.id, team.id, 400, day(W1, 1));

    await settleWeek(t.id, W1, SETTLE_AT);

    expect(await weekly(t.id, me.id, W1)).toMatchObject({
      activeDays: 1,
      multiplierPct: 100,
      distancePoints: 24,
      extraPoints: 0,
    });
    expect(await multiplierEntries(t.id, me.id)).toEqual([]);
  });

  it("grows the streak by 5% per earlier 3+ week and caps it at x1.40", async () => {
    const me = await user("me");
    const { t, team } = await tournamentWith(me.id);
    const weeks = [
      "2026-05-04",
      "2026-05-11",
      "2026-05-18",
      "2026-05-25",
      "2026-06-01",
      "2026-06-08",
    ];
    for (const w of weeks) {
      for (const offset of [0, 1, 2]) await swim(me.id, t.id, team.id, 1000, day(w, offset));
    }

    for (const w of weeks) await settleWeek(t.id, w, SETTLE_AT);

    const rows = await db.weeklyResult.findMany({
      where: { tournamentId: t.id, userId: me.id },
      orderBy: { weekStart: "asc" },
    });
    expect(rows.map((r) => r.multiplierPct)).toEqual([120, 125, 130, 135, 140, 140]);
    expect(rows.map((r) => r.streakWeeks)).toEqual([1, 2, 3, 4, 5, 6]);
    // 30 distance points per week.
    expect(rows.map((r) => r.extraPoints)).toEqual([6, 8, 9, 11, 12, 12]);
  });

  it("restarts the streak after a 2-day week", async () => {
    const me = await user("me");
    const { t, team } = await tournamentWith(me.id);
    const W3 = "2026-05-18";
    for (const offset of [0, 1, 2]) await swim(me.id, t.id, team.id, 1000, day(W1, offset));
    for (const offset of [0, 1]) await swim(me.id, t.id, team.id, 1000, day(W2, offset));
    for (const offset of [0, 1, 2]) await swim(me.id, t.id, team.id, 1000, day(W3, offset));

    for (const w of [W1, W2, W3]) await settleWeek(t.id, w, SETTLE_AT);

    expect((await weekly(t.id, me.id, W2)).multiplierPct).toBe(110);
    expect(await weekly(t.id, me.id, W3)).toMatchObject({ multiplierPct: 120, streakWeeks: 1 });
  });

  it("uses the tournament's multiplier values", async () => {
    const me = await user("me");
    const { t, team } = await tournamentWith(me.id, {
      multiplierThreeDaysPct: 150,
      multiplierMaxPct: 150,
    });
    for (const offset of [0, 1, 2]) await swim(me.id, t.id, team.id, 1000, day(W1, offset));

    await settleWeek(t.id, W1, SETTLE_AT);

    expect(await weekly(t.id, me.id, W1)).toMatchObject({ multiplierPct: 150, extraPoints: 15 });
  });

  it("settles a week once: a second call writes nothing", async () => {
    const me = await user("me");
    const { t, team } = await tournamentWith(me.id);
    for (const offset of [0, 1, 2]) await swim(me.id, t.id, team.id, 1000, day(W1, offset));
    await settleWeek(t.id, W1, SETTLE_AT);

    expect(await settleWeek(t.id, W1, SETTLE_AT)).toBe(false);
    expect(await Promise.all([settleWeek(t.id, W1), settleWeek(t.id, W1)])).toEqual([false, false]);

    expect((await multiplierEntries(t.id, me.id)).map((e) => e.points)).toEqual([6]);
    expect(await db.weekSettlement.count()).toBe(1);
  });

  it("gives the extra points to the player's team when the week ended", async () => {
    const me = await user("me");
    const { t, team: before } = await tournamentWith(me.id);
    const after = await addTeam(t.id);
    await swim(me.id, t.id, before.id, 1000, day(W1, 0));
    await swim(me.id, t.id, before.id, 1000, day(W1, 1));
    const switchedAt = new Date(`${day(W1, 2)}T00:00:00+07:00`);
    await db.teamMember.updateMany({
      where: { userId: me.id },
      data: { status: "LEFT", endedAt: switchedAt, endReason: "SWITCHED" },
    });
    await db.teamMember.create({
      data: { tournamentId: t.id, teamId: after.id, userId: me.id, joinedAt: switchedAt },
    });
    await swim(me.id, t.id, after.id, 1000, day(W1, 3));

    await settleWeek(t.id, W1, SETTLE_AT);

    expect((await multiplierEntries(t.id, me.id)).map((e) => e.teamId)).toEqual([after.id]);
    expect((await weekly(t.id, me.id, W1)).teamId).toBe(after.id);
  });

  it("settles every player of the tournament, and only players with results that week", async () => {
    const me = await user("me");
    const other = await user("other");
    const idle = await user("idle");
    const { t, team } = await tournamentWith(me.id);
    for (const u of [other, idle]) {
      await db.teamMember.create({ data: { tournamentId: t.id, teamId: team.id, userId: u.id } });
    }
    for (const offset of [0, 1]) await swim(me.id, t.id, team.id, 1000, day(W1, offset));
    for (const offset of [0, 1, 2]) await swim(other.id, t.id, team.id, 2000, day(W1, offset));

    await settleWeek(t.id, W1, SETTLE_AT);

    const rows = await db.weeklyResult.findMany({ where: { tournamentId: t.id } });
    expect(rows.map((r) => [r.userId, r.multiplierPct]).sort()).toEqual(
      [
        [me.id, 110],
        [other.id, 120],
      ].sort(),
    );
  });

  it("rejects a week key that is not a Monday", async () => {
    const me = await user("me");
    const { t } = await tournamentWith(me.id);
    await expect(settleWeek(t.id, "2026-05-05")).rejects.toThrow();
    await expect(settleWeek(t.id, "05/04/2026")).rejects.toThrow();
    expect(await db.weekSettlement.count()).toBe(0);
  });
});

describe("recalculatePlayerWeek", () => {
  it("writes the difference as new entries and recomputes later weeks' streaks", async () => {
    const me = await user("me");
    const { t, team } = await tournamentWith(me.id);
    const revoked = await swim(me.id, t.id, team.id, 1000, day(W1, 0));
    for (const offset of [1, 2]) await swim(me.id, t.id, team.id, 1000, day(W1, offset));
    for (const offset of [0, 1, 2]) await swim(me.id, t.id, team.id, 1000, day(W2, offset));
    await settleWeek(t.id, W1, SETTLE_AT);
    await settleWeek(t.id, W2, SETTLE_AT);
    // Week 1: 30 x 1.20 = +6; week 2 (streak): 30 x 1.25 = +8 (7.5 rounds up).
    expect((await multiplierEntries(t.id, me.id)).map((e) => e.points)).toEqual([6, 8]);
    const progress = await progressOf(team.id);

    await db.swimResult.update({ where: { id: revoked.id }, data: { status: "REVOKED" } });
    const teams = await db.$transaction((tx) => recalculatePlayerWeek(tx, t.id, me.id, W1));

    expect(teams).toEqual([team.id]);
    // Week 1: 2 days, 20 x 1.10 = +2 (6 -> 2: -4); week 2: no streak, 30 x 1.20 = +6 (-2).
    expect((await multiplierEntries(t.id, me.id)).map((e) => [e.vnDay, e.points])).toEqual([
      [W1, 6],
      [W2, 8],
      [W1, -4],
      [W2, -2],
    ]);
    expect(await weekly(t.id, me.id, W1)).toMatchObject({
      activeDays: 2,
      multiplierPct: 110,
      distancePoints: 20,
      extraPoints: 2,
      streakWeeks: 0,
    });
    expect(await weekly(t.id, me.id, W2)).toMatchObject({
      multiplierPct: 120,
      extraPoints: 6,
      streakWeeks: 1,
    });
    // The caller refreshes the progress of the returned teams; nothing is refreshed here.
    expect(await progressOf(team.id)).toBe(progress);
  });

  it("changes nothing when the result did not change", async () => {
    const me = await user("me");
    const { t, team } = await tournamentWith(me.id);
    for (const offset of [0, 1, 2]) await swim(me.id, t.id, team.id, 1000, day(W1, offset));
    await settleWeek(t.id, W1, SETTLE_AT);

    const teams = await db.$transaction((tx) => recalculatePlayerWeek(tx, t.id, me.id, W1));

    expect(teams).toEqual([]);
    expect((await multiplierEntries(t.id, me.id)).map((e) => e.points)).toEqual([6]);
  });

  it("does nothing for a week that is not settled yet", async () => {
    const me = await user("me");
    const { t, team } = await tournamentWith(me.id);
    for (const offset of [0, 1, 2]) await swim(me.id, t.id, team.id, 1000, day(W1, offset));

    const teams = await db.$transaction((tx) => recalculatePlayerWeek(tx, t.id, me.id, W1));

    expect(teams).toEqual([]);
    expect(await db.weeklyResult.count()).toBe(0);
    expect(await multiplierEntries(t.id, me.id)).toEqual([]);
  });
});

describe("endedSeasonWeeks", () => {
  const season = {
    seasonStartAt: new Date("2026-05-01T06:00:00+07:00"),
    seasonEndAt: new Date("2026-05-17T23:59:00+07:00"),
  };

  it("lists the weeks that overlap the season and have ended, in order", () => {
    expect(endedSeasonWeeks(season, new Date("2026-05-11T00:00:00+07:00"))).toEqual([
      "2026-04-27",
      "2026-05-04",
    ]);
    expect(endedSeasonWeeks(season, new Date("2026-06-30T00:00:00+07:00"))).toEqual([
      "2026-04-27",
      "2026-05-04",
      "2026-05-11",
    ]);
    expect(endedSeasonWeeks(season, new Date("2026-05-03T23:59:00+07:00"))).toEqual([]);
  });
});

describe("runDueWeekSettlements", () => {
  it("settles the ended weeks of published tournaments once", async () => {
    const me = await user("me");
    const { t, team } = await tournamentWith(me.id);
    const draft = await tournamentWith(me.id, { status: "DRAFT" });
    for (const offset of [0, 1, 2]) await swim(me.id, t.id, team.id, 1000, day(W1, offset));
    for (const offset of [0, 1, 2]) await swim(me.id, t.id, team.id, 1000, day(W2, offset));
    const midWeek2 = new Date(`${day(W2, 3)}T12:00:00+07:00`);

    expect(await runDueWeekSettlements(midWeek2)).toEqual({ weeks: 2, failed: 0 });
    expect((await multiplierEntries(t.id, me.id)).map((e) => [e.vnDay, e.points])).toEqual([
      [W1, 6],
    ]);

    expect(await runDueWeekSettlements(SETTLE_AT)).toEqual({ weeks: 8, failed: 0 });
    expect(await runDueWeekSettlements(SETTLE_AT)).toEqual({ weeks: 0, failed: 0 });
    expect((await multiplierEntries(t.id, me.id)).map((e) => [e.vnDay, e.points])).toEqual([
      [W1, 6],
      [W2, 8],
    ]);
    expect(await db.weekSettlement.count({ where: { tournamentId: draft.t.id } })).toBe(0);
  });

  it("rejects an invalid date", async () => {
    await expect(runDueWeekSettlements(new Date("nope"))).rejects.toThrow(TypeError);
  });
});
