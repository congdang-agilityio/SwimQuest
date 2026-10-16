import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError } from "@/server/auth/roles";
import { getReviewItem, getReviewQueue } from "./queue";

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

beforeEach(clean);
afterAll(clean);

const user = (n: string) =>
  db.user.create({ data: { email: `${n}@example.com`, passwordHash: "h", displayName: n } });

async function tournament(organizerId: string, name: string) {
  const t = await db.tournament.create({
    data: {
      organizerId,
      name,
      description: "d",
      status: "ACTIVE",
      seasonStartAt: new Date("2026-05-01T00:00:00+07:00"),
      seasonEndAt: new Date("2026-07-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100000,
      slowestPaceSecPer100m: 300,
      fastestPaceSecPer100m: 65,
      longestRealisticSwimM: 30000,
    },
  });
  const team = await db.team.create({
    data: { tournamentId: t.id, name: `${name}-team`, emblemKey: "dolphin", memberLimit: 5 },
  });
  return { t, team };
}

type Point = { lat: number; lon: number; time: string | null };

const swim = (userId: string, startedAt: string, durationS: number, track: Point[] = []) =>
  db.swim.create({
    data: {
      userId,
      source: "GPX",
      fileSha256: "a".repeat(64),
      originalFilename: "swim.gpx",
      startedAt: new Date(startedAt),
      endedAt: new Date(new Date(startedAt).getTime() + durationS * 1000),
      distanceM: 1000,
      durationS,
      swimType: "OPEN_WATER",
      sport: "swimming",
      isSwim: true,
      ...(track.length > 0 ? { track } : {}),
    },
  });

const result = (
  s: { id: string; userId: string },
  t: { id: string },
  teamId: string,
  status: "FLAGGED" | "VERIFIED",
  reasons: string[],
  createdAt: Date,
) =>
  db.swimResult.create({
    data: {
      swimId: s.id,
      tournamentId: t.id,
      teamId,
      userId: s.userId,
      status,
      reasons,
      createdAt,
    },
  });

async function setup() {
  const organizer = await user("organizer");
  const player = await user("player");
  const outsider = await user("outsider");
  const { t, team } = await tournament(organizer.id, "Cup");
  const other = await tournament(outsider.id, "Other");
  const track = Array.from({ length: 1200 }, (_, i) => ({
    lat: 10 + i / 10000,
    lon: 106,
    time: null,
  }));
  // 1000 m in 3300 s = 5:30 per 100 m, slower than the 5:00 limit.
  const slow = await swim(player.id, "2026-06-02T06:00:00+07:00", 3300, track);
  const early = await swim(player.id, "2026-06-01T06:00:00+07:00", 3300);
  const ok = await swim(player.id, "2026-06-03T06:00:00+07:00", 1800);
  const flagged = await result(slow, t, team.id, "FLAGGED", ["PACE_TOO_SLOW"], new Date(2000));
  const first = await result(early, t, team.id, "FLAGGED", ["PACE_TOO_SLOW"], new Date(1000));
  await result(ok, t, team.id, "VERIFIED", [], new Date(3000));
  const elsewhere = await result(
    slow,
    other.t,
    other.team.id,
    "FLAGGED",
    ["PACE_TOO_SLOW"],
    new Date(500),
  );
  return { organizer, player, outsider, t, flagged, first, elsewhere };
}

describe("getReviewQueue", () => {
  it("lists only this tournament's flagged results, oldest first, with reason params", async () => {
    const { organizer, player, t, flagged, first } = await setup();

    const queue = await getReviewQueue(organizer.id, t.id);

    expect(queue.map((i) => i.resultId)).toEqual([first.id, flagged.id]);
    expect(queue[1]).toEqual({
      resultId: flagged.id,
      swimId: flagged.swimId,
      player: { id: player.id, displayName: "player" },
      startedAt: new Date("2026-06-02T06:00:00+07:00").toISOString(),
      date: "2026-06-02",
      distanceM: 1000,
      durationS: 3300,
      pacePer100mS: 330,
      swimType: "OPEN_WATER",
      reasons: [{ code: "PACE_TOO_SLOW", limit: 300, value: 330 }],
    });
    expect(JSON.stringify(queue)).not.toContain("@example.com");
    expect(JSON.stringify(queue)).not.toContain("track");
  });

  it("refuses a non-reviewer and reports an unknown tournament", async () => {
    const { player, outsider, t } = await setup();

    await expect(getReviewQueue(player.id, t.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getReviewQueue(outsider.id, t.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getReviewQueue(outsider.id, "nope")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("getReviewItem", () => {
  it("includes a simplified track of at most 500 points for the organizer", async () => {
    const { organizer, flagged } = await setup();

    const item = await getReviewItem(organizer.id, flagged.id);

    expect(item.resultId).toBe(flagged.id);
    expect(item.reasons).toEqual([{ code: "PACE_TOO_SLOW", limit: 300, value: 330 }]);
    expect(item.track.length).toBeLessThanOrEqual(500);
    expect(item.track.length).toBeGreaterThan(100);
    expect(item.track[0]).toEqual({ lat: 10, lon: 106 });
    expect(item.track.at(-1)).toEqual({ lat: 10 + 1199 / 10000, lon: 106 });
    expect(JSON.stringify(item)).not.toContain("@example.com");
  });

  it("returns an empty track when the swim has none", async () => {
    const { organizer, first } = await setup();

    expect((await getReviewItem(organizer.id, first.id)).track).toEqual([]);
  });

  it("refuses everyone but the result's tournament reviewers", async () => {
    const { organizer, player, outsider, flagged, elsewhere } = await setup();

    await expect(getReviewItem(player.id, flagged.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getReviewItem(outsider.id, flagged.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getReviewItem(organizer.id, elsewhere.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getReviewItem(organizer.id, "nope")).rejects.toBeInstanceOf(NotFoundError);
  });
});
