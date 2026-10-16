import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { listMembersBadges, listUserBadges } from "./list";

async function clean() {
  await db.badge.deleteMany();
  await db.xpEntry.deleteMany();
  await db.pointsEntry.deleteMany();
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.user.deleteMany();
}

const user = (n: string) =>
  db.user.create({ data: { email: `${n}@example.com`, passwordHash: "h", displayName: n } });

const tournament = (organizerId: string, name: string) =>
  db.tournament.create({
    data: {
      organizerId,
      name,
      description: "d",
      status: "PUBLISHED",
      seasonStartAt: new Date("2026-11-01T00:00:00+07:00"),
      seasonEndAt: new Date("2026-12-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100000,
    },
  });

describe("badge listing", () => {
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  async function seed() {
    const org = await user("org");
    const a = await user("a");
    const b = await user("b");
    const t1 = await tournament(org.id, "One");
    const t2 = await tournament(org.id, "Two");
    const badge = (
      tournamentId: string,
      userId: string,
      kind: "PARTICIPATION" | "EXPLORER" | "SPECIAL",
      awardedAt: string,
      extra: { reason?: string; removedAt?: Date } = {},
    ) =>
      db.badge.create({
        data: { tournamentId, userId, kind, awardedAt: new Date(awardedAt), ...extra },
      });
    await badge(t1.id, a.id, "PARTICIPATION", "2026-11-02T00:00:00Z");
    await badge(t1.id, a.id, "EXPLORER", "2026-11-03T00:00:00Z", { removedAt: new Date() });
    await badge(t2.id, a.id, "SPECIAL", "2026-12-02T00:00:00Z", { reason: "Great spirit" });
    await badge(t1.id, b.id, "EXPLORER", "2026-11-04T00:00:00Z");
    return { a, b, t1, t2 };
  }

  it("lists a player's badges across tournaments, newest first, without removed ones", async () => {
    const { a, t1, t2 } = await seed();
    const list = await listUserBadges(a.id);
    expect(list.map((x) => x.kind)).toEqual(["SPECIAL", "PARTICIPATION"]);
    expect(list[0].tournament).toEqual({ id: t2.id, name: "Two" });
    expect(list[1].tournament).toEqual({ id: t1.id, name: "One" });
    expect(list[0].awardedAt).toEqual(new Date("2026-12-02T00:00:00Z"));
  });

  it("includes the organizer's reason on Special badges", async () => {
    const { a } = await seed();
    const [special, participation] = await listUserBadges(a.id);
    expect(special.reason).toBe("Great spirit");
    expect(participation.reason).toBeNull();
  });

  it("returns an empty list for a player with no badges", async () => {
    const c = await user("c");
    expect(await listUserBadges(c.id)).toEqual([]);
  });

  it("lists members' badges of one tournament grouped by user", async () => {
    const { a, b, t1 } = await seed();
    const c = await user("c");
    const map = await listMembersBadges(t1.id, [a.id, b.id, c.id]);
    expect(map.get(a.id)?.map((x) => x.kind)).toEqual(["PARTICIPATION"]);
    expect(map.get(b.id)?.map((x) => x.kind)).toEqual(["EXPLORER"]);
    expect(map.get(c.id)).toEqual([]);
  });

  it("returns an empty map entry set for no members", async () => {
    const { t1 } = await seed();
    expect((await listMembersBadges(t1.id, [])).size).toBe(0);
  });
});
