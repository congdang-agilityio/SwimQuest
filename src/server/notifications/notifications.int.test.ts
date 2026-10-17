import type { SwimResultStatus } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import { emitEvent } from "../events/emit";
import { clearHandlers, registerNotificationHandlers } from "../events/handlers";
import type { DomainEventInput } from "../events/types";
import { assertInternalLink } from "./handlers";
import { listNotifications, markAllRead, unreadCount } from "./inbox";

async function clean() {
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
  await db.domainEvent.deleteMany();
  await db.notification.deleteMany();
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

async function setup(startDestination: string | null = "hon_sup") {
  const [a, b, outsider] = await Promise.all([user("a"), user("b"), user("c")]);
  const t = await db.tournament.create({
    data: {
      organizerId: outsider.id,
      name: "Cup",
      description: "d",
      seasonStartAt: new Date("2027-01-01T00:00:00Z"),
      seasonEndAt: new Date("2027-03-01T00:00:00Z"),
      routeId: "route01",
      routeDistanceM: 100000,
    },
  });
  const team = await db.team.create({
    data: {
      tournamentId: t.id,
      name: "Otters",
      emblemKey: "otter",
      memberLimit: 5,
      startDestination,
      startSetBy: startDestination ? "CAPTAIN" : null,
    },
  });
  for (const u of [a, b]) {
    await db.teamMember.create({ data: { teamId: team.id, tournamentId: t.id, userId: u.id } });
  }
  // A former member must not be notified.
  const left = await user("left");
  await db.teamMember.create({
    data: {
      teamId: team.id,
      tournamentId: t.id,
      userId: left.id,
      status: "LEFT",
      endedAt: new Date(),
      endReason: "LEFT",
    },
  });
  return { a, b, outsider, left, tournamentId: t.id, teamId: team.id };
}

const emit = (event: DomainEventInput) => db.$transaction((tx) => emitEvent(tx, event));
const all = () => db.notification.findMany({ orderBy: { createdAt: "asc" } });

describe("notifications from domain events", () => {
  beforeEach(async () => {
    clearHandlers();
    registerNotificationHandlers();
    await clean();
  });
  afterAll(async () => {
    clearHandlers();
    await clean();
    await db.$disconnect();
  });

  describe("verification", () => {
    const swim = (
      s: SwimResultStatus,
      prev: SwimResultStatus | null,
      ids: Awaited<ReturnType<typeof setup>>,
    ) =>
      emit({
        type: "SWIM_RESULT_CHANGED",
        payload: {
          tournamentId: ids.tournamentId,
          teamId: ids.teamId,
          resultId: "r1",
          swimId: "s1",
          userId: ids.a.id,
          status: s,
          previousStatus: prev,
        },
      });

    it.each([
      ["VERIFIED", "swim.verified"],
      ["FLAGGED", "swim.flagged"],
      ["REJECTED", "swim.rejected"],
      ["REVOKED", "swim.revoked"],
      ["RULE_MISSED", "swim.ruleMissed"],
    ] as const)("tells the owner a result is %s", async (status, type) => {
      const ids = await setup();
      await swim(status, null, ids);
      const rows = await all();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        userId: ids.a.id,
        category: "VERIFICATION",
        type,
        link: "/swims/s1",
        params: { swimId: "s1", resultId: "r1", status },
      });
    });

    it("tells the owner a dispute was decided", async () => {
      const ids = await setup();
      await swim("VERIFIED", "DISPUTED", ids);
      expect((await all())[0]).toMatchObject({ type: "swim.disputeDecided" });
    });

    it("stays silent for duplicates, raised disputes and unchanged status", async () => {
      const ids = await setup();
      await swim("DUPLICATE", null, ids);
      await swim("DISPUTED", "VERIFIED", ids);
      await swim("VERIFIED", "VERIFIED", ids);
      expect(await all()).toHaveLength(0);
    });
  });

  describe("team and invitations", () => {
    it("notifies the player only for joined, moved, removed and captain", async () => {
      const ids = await setup();
      const base = { tournamentId: ids.tournamentId, teamId: ids.teamId, userId: ids.a.id };
      await emit({ type: "TEAM_JOINED", payload: base });
      await emit({ type: "TEAM_MEMBER_MOVED", payload: { ...base, fromTeamId: "old" } });
      await emit({ type: "TEAM_MEMBER_REMOVED", payload: { ...base, removedBy: ids.b.id } });
      await emit({ type: "TEAM_CAPTAIN_SET", payload: { ...base, setBy: ids.b.id } });
      const rows = await all();
      expect(rows.map((r) => r.type)).toEqual([
        "team.joined",
        "team.moved",
        "team.removed",
        "team.captainSet",
      ]);
      for (const r of rows) {
        expect(r).toMatchObject({ userId: ids.a.id, category: "TEAM", link: "/team" });
      }
      expect(rows[1].params).toMatchObject({ fromTeamId: "old" });
    });

    it("sends an invitation for a player added to a team", async () => {
      const ids = await setup();
      await emit({
        type: "PLAYER_ADDED_TO_TEAM",
        payload: {
          tournamentId: ids.tournamentId,
          teamId: ids.teamId,
          userId: ids.a.id,
          addedBy: ids.outsider.id,
        },
      });
      expect((await all())[0]).toMatchObject({
        category: "INVITATIONS",
        type: "team.invited",
        link: "/team",
        userId: ids.a.id,
      });
    });

    it("tells every active member when the start is chosen, assigned or locked", async () => {
      const ids = await setup();
      const t = { tournamentId: ids.tournamentId, teamId: ids.teamId };
      await emit({
        type: "TEAM_START_SET",
        payload: { ...t, startId: "hon_sup", setBy: ids.a.id },
      });
      await db.team.update({ where: { id: ids.teamId }, data: { startSetBy: "AUTOMATIC" } });
      await emit({
        type: "TEAM_START_SET",
        payload: { ...t, startId: "hon_sup", setBy: ids.a.id },
      });
      await emit({ type: "TEAM_START_LOCKED", payload: { ...t, startId: "hon_sup" } });
      const rows = await all();
      expect(rows).toHaveLength(6);
      expect(new Set(rows.map((r) => r.userId))).toEqual(new Set([ids.a.id, ids.b.id]));
      expect([...new Set(rows.map((r) => r.type))].sort()).toEqual([
        "team.startAssigned",
        "team.startChosen",
        "team.startLocked",
      ]);
      expect(rows.every((r) => r.category === "TEAM" && r.link === "/team")).toBe(true);
    });
  });

  describe("milestones", () => {
    it("tells members when a destination was passed, and nothing before that", async () => {
      const ids = await setup("hon_sup");
      const t = { tournamentId: ids.tournamentId, teamId: ids.teamId };
      await emit({ type: "TEAM_PROGRESS_CHANGED", payload: { ...t, fromBp: 0, toBp: 3000 } });
      expect(await all()).toHaveLength(0);
      await emit({ type: "TEAM_PROGRESS_CHANGED", payload: { ...t, fromBp: 3000, toBp: 7000 } });
      const rows = await all();
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({
        category: "MILESTONES",
        type: "milestone.destinationPassed",
        link: "/voyage",
        params: { destination: "cu_lao_cham", teamId: ids.teamId },
      });
      expect(new Set(rows.map((r) => r.userId))).toEqual(new Set([ids.a.id, ids.b.id]));
    });

    it("ignores progress of a team without a start", async () => {
      const ids = await setup(null);
      await emit({
        type: "TEAM_PROGRESS_CHANGED",
        payload: { tournamentId: ids.tournamentId, teamId: ids.teamId, fromBp: 0, toBp: 9000 },
      });
      expect(await all()).toHaveLength(0);
    });

    it("tells members when the team finished or lost its finish", async () => {
      const ids = await setup();
      const t = { tournamentId: ids.tournamentId, teamId: ids.teamId };
      await emit({ type: "TEAM_FINISHED", payload: t });
      await emit({ type: "TEAM_FINISH_LOST", payload: t });
      const rows = await all();
      expect(rows.map((r) => r.type)).toEqual([
        "milestone.finished",
        "milestone.finished",
        "milestone.finishLost",
        "milestone.finishLost",
      ]);
      expect(rows.every((r) => r.link === "/voyage")).toBe(true);
    });

    it("tells the player about a badge and a level up, not a level down", async () => {
      const ids = await setup();
      await emit({ type: "BADGE_AWARDED", payload: { userId: ids.a.id, badgeKey: "first_swim" } });
      await emit({
        type: "LEVEL_CHANGED",
        payload: { userId: ids.a.id, fromLevel: 1, toLevel: 2 },
      });
      await emit({
        type: "LEVEL_CHANGED",
        payload: { userId: ids.a.id, fromLevel: 2, toLevel: 1 },
      });
      const rows = await all();
      expect(rows.map((r) => [r.type, r.link])).toEqual([
        ["milestone.badgeEarned", "/profile"],
        ["milestone.levelUp", "/profile"],
      ]);
      expect(rows[0].params).toEqual({ badgeKey: "first_swim" });
    });
  });

  it("rejects a link that is not an internal path", () => {
    for (const bad of [
      "//evil.com",
      "https://evil.com",
      "javascript:x",
      "swims/1",
      "/\\evil",
      "",
    ]) {
      expect(() => assertInternalLink(bad)).toThrow();
    }
    expect(assertInternalLink("/swims/abc?x=1")).toBe("/swims/abc?x=1");
  });

  describe("inbox", () => {
    it("lists newest first in pages, counts unread and marks all read", async () => {
      const ids = await setup();
      const base = new Date("2027-01-01T00:00:00Z").getTime();
      await db.notification.createMany({
        data: Array.from({ length: 25 }, (_, i) => ({
          userId: ids.a.id,
          category: "TEAM" as const,
          type: `n${i}`,
          link: "/team",
          createdAt: new Date(base + i * 1000),
        })),
      });
      await db.notification.create({
        data: { userId: ids.b.id, category: "TEAM", type: "other", link: "/team" },
      });

      expect(await unreadCount(ids.a.id)).toBe(25);
      const first = await listNotifications(ids.a.id);
      expect(first.items).toHaveLength(20);
      expect(first.items[0].type).toBe("n24");
      expect(first.nextCursor).not.toBeNull();
      const second = await listNotifications(ids.a.id, first.nextCursor);
      expect(second.items.map((n) => n.type)).toEqual(["n4", "n3", "n2", "n1", "n0"]);
      expect(second.nextCursor).toBeNull();

      expect(await markAllRead(ids.a.id)).toBe(25);
      expect(await unreadCount(ids.a.id)).toBe(0);
      expect(await unreadCount(ids.b.id)).toBe(1);
      expect((await listNotifications(ids.a.id)).items).toHaveLength(20);
    });
  });
});
