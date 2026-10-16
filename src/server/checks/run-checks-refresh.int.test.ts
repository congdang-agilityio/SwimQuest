import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SwimResult } from "@prisma/client";
import { db } from "@/server/db";
import { runChecks } from "./run-checks";

const refreshed = vi.hoisted(() => [] as string[]);
vi.mock("@/server/progress/update-team-progress", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/progress/update-team-progress")>();
  return {
    ...actual,
    updateTeamProgress: vi.fn(async (...args: Parameters<typeof actual.updateTeamProgress>) => {
      refreshed.push(args[2]);
      return actual.updateTeamProgress(...args);
    }),
  };
});

async function clean() {
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

async function tournament(name: string) {
  const org = await user(`org-${name}`);
  return db.tournament.create({
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
}

const team = (id: string, tournamentId: string) =>
  db.team.create({ data: { id, tournamentId, name: id, emblemKey: "dolphin", memberLimit: 5 } });

const swimData = (userId: string) => ({
  userId,
  source: "FIT" as const,
  fileSha256: "f".repeat(64),
  originalFilename: "swim.fit",
  startedAt: new Date("2026-06-01T06:00:00+07:00"),
  endedAt: new Date("2026-06-01T06:45:00+07:00"),
  createdAt: new Date("2026-06-01T07:00:00+07:00"),
  distanceM: 1000,
  durationS: 2700,
  swimType: "POOL" as const,
  sport: "swimming",
  isSwim: true,
});

describe("runChecks team refresh (lock order across memberships)", () => {
  beforeEach(async () => {
    refreshed.length = 0;
    await clean();
  });
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("refreshes every changed team once, after all results, in ascending team id order", async () => {
    const me = await user("me");
    const one = await tournament("One");
    const two = await tournament("Two");
    // One: the player is in team-a; a settled week also changed team-z (e.g. an old team).
    await team("team-a", one.id);
    await team("team-z", one.id);
    // Two: the player is in team-m.
    await team("team-m", two.id);
    await db.teamMember.create({ data: { tournamentId: one.id, teamId: "team-a", userId: me.id } });
    await db.teamMember.create({ data: { tournamentId: two.id, teamId: "team-m", userId: me.id } });
    const swim = await db.swim.create({ data: swimData(me.id) });
    const onVerified = vi.fn(async (_tx: unknown, result: SwimResult) =>
      result.tournamentId === one.id
        ? [
            { tournamentId: one.id, teamId: "team-a" },
            { tournamentId: one.id, teamId: "team-z" },
          ]
        : [
            { tournamentId: two.id, teamId: "team-m" },
            { tournamentId: two.id, teamId: "team-m" },
          ],
    );

    await db.$transaction((tx) =>
      runChecks(tx, swim, { onVerified }, new Date("2026-06-01T08:00:00+07:00")),
    );

    expect(onVerified).toHaveBeenCalledTimes(2);
    expect(refreshed).toEqual(["team-a", "team-m", "team-z"]);
  });

  it("refreshes the player's team after a verified upload with the default hooks", async () => {
    const me = await user("me");
    const one = await tournament("One");
    await team("team-a", one.id);
    await db.teamMember.create({ data: { tournamentId: one.id, teamId: "team-a", userId: me.id } });
    const swim = await db.swim.create({ data: swimData(me.id) });

    await db.$transaction((tx) => runChecks(tx, swim, {}, new Date("2026-06-01T08:00:00+07:00")));

    expect(refreshed).toEqual(["team-a"]);
    expect(
      (await db.team.findUniqueOrThrow({ where: { id: "team-a" } })).progressBp,
    ).toBeGreaterThan(0);
  });
});
