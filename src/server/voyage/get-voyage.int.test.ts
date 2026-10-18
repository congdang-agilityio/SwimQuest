import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { getVoyage } from "./get-voyage";
import anchors from "../../../public/art/route01/map-anchors.json";

async function clean() {
  await db.xpEntry.deleteMany();
  await db.pointsEntry.deleteMany();
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.user.deleteMany();
}

const user = (n: string) =>
  db.user.create({ data: { email: `${n}@example.com`, passwordHash: "h", displayName: n } });

async function setup(start: string | null, points: number) {
  const me = await user("me");
  const t = await db.tournament.create({
    data: {
      organizerId: me.id,
      name: "T",
      description: "d",
      status: "PUBLISHED",
      seasonStartAt: new Date("2026-11-01T00:00:00+07:00"),
      seasonEndAt: new Date("2026-12-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100000,
      pointsPerKm: 10,
    },
  });
  const setAt = new Date("2026-10-20T00:00:00Z");
  const team = await db.team.create({
    data: {
      tournamentId: t.id,
      name: "Team",
      emblemKey: "dolphin",
      memberLimit: 5,
      startDestination: start,
      startSetAt: start ? setAt : null,
      startSetBy: start ? "CAPTAIN" : null,
    },
  });
  await db.teamMember.create({ data: { tournamentId: t.id, teamId: team.id, userId: me.id } });
  if (points > 0) {
    await db.pointsEntry.create({
      data: {
        tournamentId: t.id,
        teamId: team.id,
        userId: me.id,
        kind: "DISTANCE",
        points,
        countedM: 1,
        vnDay: "2026-11-02",
      },
    });
  }
  return { me, t, team, setAt };
}

describe("getVoyage", () => {
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("returns null without a current team", async () => {
    const u = await user("lonely");
    expect(await getVoyage(u.id)).toBeNull();
  });

  it("has no path and no ship before a start is chosen", async () => {
    const { me, t, team } = await setup(null, 680);
    const v = await getVoyage(me.id);
    expect(v!.tournament.id).toBe(t.id);
    expect(v!.team.id).toBe(team.id);
    expect(v!.start).toBeNull();
    expect(v!.path).toBeNull();
    expect(v!.ship).toBeNull();
    expect(v!.destinations).toHaveLength(7);
    expect(v!.destinations[0]).toEqual({
      slug: "non_nuoc",
      ...anchors.anchors.non_nuoc,
      isFinish: false,
    });
    expect(v!.destinations[6].isFinish).toBe(true);
    expect(v!.progress.progressBp).toBe(6800);
  });

  it("runs the path from the start to Ly Son and puts the ship 68% along it", async () => {
    const { me, setAt } = await setup("son_thuy", 680);
    const v = await getVoyage(me.id);
    expect(v!.start).toEqual({ slug: "son_thuy", setBy: "CAPTAIN", setAt });
    expect(v!.path!.map((p) => [p.x, p.y])).toEqual(
      ["son_thuy", "pham_van_dong", "man_thai", "hon_sup", "cu_lao_cham", "ly_son"].map((s) => {
        const a = anchors.anchors[s as keyof typeof anchors.anchors];
        return [a.x, a.y];
      }),
    );
    const pts = v!.path!;
    const aspect = anchors.width / anchors.height;
    const seg = pts.slice(1).map((p, i) => Math.hypot((p.x - pts[i].x) * aspect, p.y - pts[i].y));
    const total = seg.reduce((a, b) => a + b, 0);
    let rem = 0.68 * total;
    let i = 0;
    while (rem > seg[i]) rem -= seg[i++];
    const t = rem / seg[i];
    expect(v!.ship!.x).toBeCloseTo(pts[i].x + (pts[i + 1].x - pts[i].x) * t, 6);
    expect(v!.ship!.y).toBeCloseTo(pts[i].y + (pts[i + 1].y - pts[i].y) * t, 6);
  });

  it("keeps the ship at Ly Son above 100% and moves it after new points", async () => {
    const { me, t, team } = await setup("non_nuoc", 5000);
    const v = await getVoyage(me.id);
    expect(v!.progress.progressBp).toBe(10000);
    expect(v!.ship).toEqual(anchors.anchors.ly_son);
    const before = await setup2(me.id, t.id, team.id);
    expect(before).toBe(true);
  });
});

async function setup2(userId: string, tournamentId: string, teamId: string) {
  await db.xpEntry.deleteMany();
  await db.pointsEntry.deleteMany();
  const at = async () => (await getVoyage(userId))!.ship!;
  const a = await at();
  await db.pointsEntry.create({
    data: {
      tournamentId,
      teamId,
      userId,
      kind: "DISTANCE",
      points: 100,
      countedM: 1,
      vnDay: "2026-11-03",
    },
  });
  const b = await at();
  return b.y !== a.y || b.x !== a.x;
}
