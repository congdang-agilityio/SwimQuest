import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { routeProgress } from "@/lib/scoring/progress";
import { db } from "@/server/db";
import { updateTeamProgress } from "@/server/progress/update-team-progress";
import { onVerified } from "@/server/scoring/on-verified";
import { updateSettings } from "./update-settings";

const SEASON_START = new Date("2026-05-01T06:00:00+07:00");
const BEFORE = new Date("2026-04-30T12:00:00+07:00");
const DURING = new Date("2026-05-10T12:00:00+07:00");
const PLATFORM = {
  pointsPerKm: 10,
  firstSwimBonusPoints: 20,
  longSwimTier1M: 1000,
  longSwimTier1Points: 10,
  longSwimTier2M: 3000,
  longSwimTier2Points: 25,
  multiplierTwoDaysPct: 110,
  multiplierThreeDaysPct: 120,
  streakStepPct: 5,
  multiplierMaxPct: 140,
};
const CHANGED = { ...PLATFORM, pointsPerKm: 20, firstSwimBonusPoints: 30, longSwimTier1M: 2500 };

async function clean() {
  await db.domainEvent.deleteMany();
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
  await db.notification.deleteMany();
  await db.badge.deleteMany();
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

const user = (n: string) =>
  db.user.create({ data: { email: `${n}@example.com`, passwordHash: "h", displayName: n } });

/** A published 100 km tournament of `organizerId` with `playerId` in its one team. */
async function tournamentWith(organizerId: string, playerId: string, name: string) {
  const t = await db.tournament.create({
    data: {
      organizerId,
      name,
      description: "d",
      status: "PUBLISHED",
      seasonStartAt: SEASON_START,
      seasonEndAt: new Date("2026-07-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100_000,
    },
  });
  const team = await db.team.create({
    data: { tournamentId: t.id, name: `${name}-team`, emblemKey: "dolphin", memberLimit: 5 },
  });
  await db.teamMember.create({ data: { tournamentId: t.id, teamId: team.id, userId: playerId } });
  return { t, team };
}

const pointsOf = async (tournamentId: string) =>
  Object.fromEntries(
    (await db.pointsEntry.findMany({ where: { tournamentId } })).map((e) => [e.kind, e.points]),
  );

const progressOf = async (teamId: string) =>
  (await db.team.findUniqueOrThrow({ where: { id: teamId } })).progressBp;

beforeEach(clean);
afterAll(async () => {
  await clean();
  await db.$disconnect();
});

describe("updateSettings points", () => {
  it("a first 2 km swim gives 40 + 30 with the saved values; another tournament keeps platform values", async () => {
    const organizer = await user("organizer");
    const player = await user("player");
    const mine = await tournamentWith(organizer.id, player.id, "mine");
    const other = await tournamentWith(organizer.id, player.id, "other");

    const saved = await updateSettings(organizer.id, mine.t.id, "points", CHANGED, BEFORE);
    expect(saved).toEqual({ ok: true, group: "points", values: CHANGED });

    const startedAt = new Date("2026-05-10T06:00:00+07:00");
    const swim = await db.swim.create({
      data: {
        userId: player.id,
        source: "FIT",
        fileSha256: "b".repeat(64),
        originalFilename: "swim.fit",
        startedAt,
        endedAt: new Date(startedAt.getTime() + 3600_000),
        distanceM: 2_000,
        durationS: 3600,
        swimType: "POOL",
        sport: "swimming",
        isSwim: true,
      },
    });
    for (const f of [mine, other]) {
      const result = await db.swimResult.create({
        data: {
          swimId: swim.id,
          tournamentId: f.t.id,
          teamId: f.team.id,
          userId: player.id,
          status: "VERIFIED",
          reasons: [],
        },
      });
      await db.$transaction((tx) => onVerified(tx, result, DURING));
    }

    // Tier 1 moved to 2,500 m, so the 2 km swim earns no long-swim bonus in my tournament.
    await expect(pointsOf(mine.t.id)).resolves.toEqual({ DISTANCE: 40, FIRST_SWIM_BONUS: 30 });
    await expect(pointsOf(other.t.id)).resolves.toEqual({
      DISTANCE: 20,
      FIRST_SWIM_BONUS: 20,
      LONG_SWIM_BONUS: 10,
    });
    // Route length in points: 100 km x 20 = 2,000, so 70 points are 3.5% and 3.5 route km.
    expect(await progressOf(mine.team.id)).toBe(350);
    const row = await db.tournament.findUniqueOrThrow({ where: { id: mine.t.id } });
    const progress = routeProgress({ teamPoints: 70, ...row });
    expect(progress).toMatchObject({ progressBp: 350, routeKmReached: 3.5, routeKmTotal: 100 });
  });

  it("route length follows points per km: the same points give half the progress at 20 per km", async () => {
    const organizer = await user("organizer");
    const player = await user("player");
    const mine = await tournamentWith(organizer.id, player.id, "mine");
    const other = await tournamentWith(organizer.id, player.id, "other");
    await updateSettings(organizer.id, mine.t.id, "points", CHANGED, BEFORE);

    for (const f of [mine, other]) {
      await db.pointsEntry.create({
        data: {
          tournamentId: f.t.id,
          userId: player.id,
          teamId: f.team.id,
          kind: "WEEKLY_MULTIPLIER",
          points: 500,
          vnDay: "2026-05-10",
        },
      });
      await db.$transaction((tx) => updateTeamProgress(tx, f.t.id, f.team.id, DURING));
    }

    expect(await progressOf(other.team.id)).toBe(5000);
    expect(await progressOf(mine.team.id)).toBe(2500);
  });

  it("is refused with SEASON_LOCKED once active, keeping the stored values", async () => {
    const organizer = await user("organizer");
    const player = await user("player");
    const { t } = await tournamentWith(organizer.id, player.id, "mine");

    for (const now of [SEASON_START, DURING]) {
      const result = await updateSettings(organizer.id, t.id, "points", CHANGED, now);
      expect(result).toEqual({ ok: false, reason: "SEASON_LOCKED" });
    }
    const row = await db.tournament.findUniqueOrThrow({ where: { id: t.id } });
    expect(row).toMatchObject(PLATFORM);
  });

  it("refuses invalid values, changing nothing", async () => {
    const organizer = await user("organizer");
    const player = await user("player");
    const { t } = await tournamentWith(organizer.id, player.id, "mine");

    const result = await updateSettings(
      organizer.id,
      t.id,
      "points",
      { ...CHANGED, pointsPerKm: "1.5", multiplierMaxPct: 100 },
      BEFORE,
    );
    expect(result).toEqual({
      ok: false,
      reason: "INVALID",
      errors: { pointsPerKm: "POINTS_INVALID" },
    });
    const row = await db.tournament.findUniqueOrThrow({ where: { id: t.id } });
    expect(row).toMatchObject(PLATFORM);
  });
});
