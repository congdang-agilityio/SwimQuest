import { createHash } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { createSwimFromUpload } from "@/server/swims/create-from-upload";
import { buildFit } from "@/server/swims/parse/__tests__/fit-builder";
import { toOwnerSwimDto } from "@/server/swims/swim-dto";
import { lockPlayerSwims, runChecks } from "./run-checks";

async function clean() {
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

type TournamentOpts = {
  status?: "DRAFT" | "PUBLISHED" | "ACTIVE" | "COMPLETED";
  slowestPaceSecPer100m?: number;
  memberStatus?: "ACTIVE" | "LEFT";
};

/** A tournament (season 1 May to 1 July 2026, Vietnam time) with `userId` in one team. */
async function tournamentWith(userId: string, name: string, opts: TournamentOpts = {}) {
  const org = await user(`org-${name}`);
  const t = await db.tournament.create({
    data: {
      organizerId: org.id,
      name,
      description: "d",
      status: opts.status ?? "PUBLISHED",
      seasonStartAt: new Date("2026-05-01T06:00:00+07:00"),
      seasonEndAt: new Date("2026-07-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100000,
      ...(opts.slowestPaceSecPer100m ? { slowestPaceSecPer100m: opts.slowestPaceSecPer100m } : {}),
    },
  });
  const team = await db.team.create({
    data: { tournamentId: t.id, name: `${name}-team`, emblemKey: "dolphin", memberLimit: 5 },
  });
  await db.teamMember.create({
    data: { tournamentId: t.id, teamId: team.id, userId, status: opts.memberStatus ?? "ACTIVE" },
  });
  return { t, team };
}

/** A pool swim FIT file: `distanceM` metres in `timerS` seconds starting at `start`. */
const fit = (start: string, timerS: number, distanceM = 1000) =>
  buildFit({ sport: 5, subSport: 17, start: new Date(start), timerS, distanceM });

const upload = (userId: string, buffer: Buffer) =>
  createSwimFromUpload(userId, { buffer, filename: "swim.fit" });

/** A stored 1000 m swim in 45 min (4:30 / 100 m) on 1 June 2026, 06:00 Vietnam time. */
const swimData = (userId: string) => ({
  userId,
  source: "FIT" as const,
  fileSha256: "f".repeat(64),
  originalFilename: "swim.fit",
  startedAt: new Date("2026-06-01T06:00:00+07:00"),
  endedAt: new Date("2026-06-01T06:45:00+07:00"),
  distanceM: 1000,
  durationS: 2700,
  swimType: "POOL" as const,
  sport: "swimming",
  isSwim: true,
});

const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

const resultsOf = (swimId: string) =>
  db.swimResult.findMany({ where: { swimId }, orderBy: { createdAt: "asc" } });

describe("runChecks on upload", () => {
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("verifies a passing swim in the player's tournament with the team", async () => {
    const me = await user("me");
    const { t, team } = await tournamentWith(me.id, "One");
    const swim = await upload(me.id, fit("2026-06-01T06:00:00+07:00", 1800)); // 3:00 / 100 m

    const results = await resultsOf(swim.id);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      tournamentId: t.id,
      teamId: team.id,
      userId: me.id,
      status: "VERIFIED",
      reasons: [],
    });
    expect(toOwnerSwimDto(swim).results).toEqual([
      { tournamentId: t.id, tournamentName: "One", status: "VERIFIED", reasons: [] },
    ]);
  });

  it("flags a swim slower than the tournament's slowest pace, with the reason", async () => {
    const me = await user("me");
    await tournamentWith(me.id, "One");
    const swim = await upload(me.id, fit("2026-06-01T06:00:00+07:00", 4000)); // 6:40 / 100 m

    const [result] = await resultsOf(swim.id);
    expect(result).toMatchObject({ status: "FLAGGED", reasons: ["PACE_TOO_SLOW"] });
    expect(await db.swimResult.count({ where: { status: "FLAGGED" } })).toBe(1);
  });

  it("flags a swim that started before the season start time", async () => {
    const me = await user("me");
    await tournamentWith(me.id, "One");
    const swim = await upload(me.id, fit("2026-05-01T05:30:00+07:00", 1800));

    const [result] = await resultsOf(swim.id);
    expect(result).toMatchObject({ status: "FLAGGED", reasons: ["OUTSIDE_SEASON"] });
  });

  it("marks a re-uploaded file as a duplicate and leaves the original unchanged", async () => {
    const me = await user("me");
    const { t } = await tournamentWith(me.id, "One");
    const file = fit("2026-06-01T06:00:00+07:00", 1800);
    const original = await upload(me.id, file);
    const originalBefore = await db.swim.findUniqueOrThrow({ where: { id: original.id } });
    const originalResultsBefore = await resultsOf(original.id);

    const again = await upload(me.id, file);

    expect(again.duplicateOfId).toBe(original.id);
    const [dup] = await resultsOf(again.id);
    expect(dup).toMatchObject({
      tournamentId: t.id,
      status: "DUPLICATE",
      reasons: ["DUPLICATE_OF_EARLIER_SWIM"],
    });
    expect(toOwnerSwimDto(again)).toMatchObject({ isDuplicate: true });
    expect(await db.swim.findUniqueOrThrow({ where: { id: original.id } })).toEqual(originalBefore);
    expect(await resultsOf(original.id)).toEqual(originalResultsBefore);
  });

  it("waits for a concurrent upload of the player and then sees it as the earlier swim", async () => {
    const me = await user("me");
    await tournamentWith(me.id, "One");
    const file = fit("2026-06-01T06:00:00+07:00", 1800);
    let settled = false;
    let pending: Promise<Awaited<ReturnType<typeof upload>>> | undefined;

    const first = await db.$transaction(async (tx) => {
      await lockPlayerSwims(tx, me.id);
      pending = upload(me.id, file).finally(() => (settled = true));
      await new Promise((r) => setTimeout(r, 300));
      expect(settled).toBe(false); // blocked on the lock
      return tx.swim.create({ data: { ...swimData(me.id), fileSha256: sha256(file) } });
    });
    const second = await pending!;

    expect(second.duplicateOfId).toBe(first.id);
    expect(await db.swimResult.count({ where: { status: "DUPLICATE" } })).toBe(1);
  });

  it("stores the swim once, verified in one tournament and flagged in another", async () => {
    const me = await user("me");
    const five = await tournamentWith(me.id, "Five", { slowestPaceSecPer100m: 300 });
    const four = await tournamentWith(me.id, "Four", { slowestPaceSecPer100m: 240 });
    const swim = await upload(me.id, fit("2026-06-01T06:00:00+07:00", 2700)); // 4:30 / 100 m

    expect(await db.swim.count()).toBe(1);
    const byTournament = Object.fromEntries(
      (await resultsOf(swim.id)).map((r) => [r.tournamentId, r]),
    );
    expect(byTournament[five.t.id]).toMatchObject({ status: "VERIFIED", reasons: [] });
    expect(byTournament[four.t.id]).toMatchObject({
      status: "FLAGGED",
      reasons: ["PACE_TOO_SLOW"],
    });
    const dto = toOwnerSwimDto(swim).results;
    expect(dto).toHaveLength(2);
    expect(dto).toContainEqual({
      tournamentId: four.t.id,
      tournamentName: "Four",
      status: "FLAGGED",
      reasons: ["PACE_TOO_SLOW"],
    });
  });

  it("creates no result for a player in no tournament", async () => {
    const me = await user("me");
    const swim = await upload(me.id, fit("2026-06-01T06:00:00+07:00", 1800));

    expect(await db.swimResult.count()).toBe(0);
    expect(toOwnerSwimDto(swim).results).toEqual([]);
  });

  it("skips tournaments the player left and ones that are draft or completed", async () => {
    const me = await user("me");
    await tournamentWith(me.id, "Left", { memberStatus: "LEFT" });
    await tournamentWith(me.id, "Draft", { status: "DRAFT" });
    await tournamentWith(me.id, "Completed", { status: "COMPLETED" });
    const active = await tournamentWith(me.id, "Active", { status: "ACTIVE" });
    const swim = await upload(me.id, fit("2026-06-01T06:00:00+07:00", 1800));

    const results = await resultsOf(swim.id);
    expect(results.map((r) => r.tournamentId)).toEqual([active.t.id]);
  });

  it("calls the onVerified hook for verified results only", async () => {
    const me = await user("me");
    const five = await tournamentWith(me.id, "Five", { slowestPaceSecPer100m: 300 });
    await tournamentWith(me.id, "Four", { slowestPaceSecPer100m: 240 });
    const swim = await db.swim.create({ data: swimData(me.id) });
    const onVerified = vi.fn(async () => {});

    await db.$transaction((tx) => runChecks(tx, swim, { onVerified }));

    expect(onVerified).toHaveBeenCalledTimes(1);
    expect(onVerified).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tournamentId: five.t.id, status: "VERIFIED" }),
    );
  });
});
