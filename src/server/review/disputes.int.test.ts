import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { SwimResultStatus } from "@prisma/client";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError } from "@/server/auth/roles";
import { lockPlayerSwims } from "@/server/checks/run-checks";
import { AlreadyDecidedError, ReasonRequiredError } from "./decide";
import { DisputeOpenError, NotDisputableError, decideDispute, raiseDispute } from "./disputes";

async function clean() {
  await db.domainEvent.deleteMany();
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
  await db.notification.deleteMany();
  await db.weeklyResult.deleteMany();
  await db.weekSettlement.deleteMany();
  await db.badge.deleteMany();
  await db.xpWeek.deleteMany();
  await db.xpEntry.deleteMany();
  await db.pointsEntry.deleteMany();
  await db.dispute.deleteMany();
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

async function tournament(organizerId: string, playerId: string, name: string) {
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
    },
  });
  const team = await db.team.create({
    data: { tournamentId: t.id, name: `${name}-team`, emblemKey: "dolphin", memberLimit: 5 },
  });
  await db.teamMember.create({
    data: { tournamentId: t.id, teamId: team.id, userId: playerId, status: "ACTIVE" },
  });
  return { t, team };
}

async function setup(status: SwimResultStatus = "REJECTED") {
  const organizer = await user("organizer");
  const otherOrganizer = await user("other-organizer");
  const player = await user("player");
  const cup = await tournament(organizer.id, player.id, "Cup");
  const other = await tournament(otherOrganizer.id, player.id, "Other");
  const swim = await db.swim.create({
    data: {
      userId: player.id,
      source: "GPX",
      fileSha256: "a".repeat(64),
      originalFilename: "swim.gpx",
      startedAt: new Date("2026-06-02T06:00:00+07:00"),
      endedAt: new Date("2026-06-02T06:55:00+07:00"),
      distanceM: 1000,
      durationS: 3300,
      swimType: "OPEN_WATER",
      sport: "swimming",
      isSwim: true,
    },
  });
  const make = (t: { id: string }, teamId: string) =>
    db.swimResult.create({
      data: {
        swimId: swim.id,
        tournamentId: t.id,
        teamId,
        userId: player.id,
        status,
        reasons: ["PACE_TOO_SLOW"],
        decisionNote: status === "REJECTED" ? "Looks like a boat ride" : null,
      },
    });
  const result = await make(cup.t, cup.team.id);
  const elsewhere = await make(other.t, other.team.id);
  return { organizer, otherOrganizer, player, cup, other, swim, result, elsewhere };
}

const later = new Date("2026-06-04T10:00:00+07:00");

describe("raiseDispute", () => {
  it.each(["REJECTED", "DUPLICATE", "RULE_MISSED"] as const)(
    "disputes a %s result: result DISPUTED, dispute stores the earlier status",
    async (status) => {
      const { player, result, elsewhere } = await setup(status);

      const out = await raiseDispute(player.id, result.id, "  I really swam it  ");

      const dispute = await db.dispute.findUniqueOrThrow({ where: { id: out.disputeId } });
      expect(dispute).toMatchObject({
        swimResultId: result.id,
        userId: player.id,
        reason: "I really swam it",
        status: "OPEN",
        previousStatus: status,
        decidedById: null,
      });
      const row = await db.swimResult.findUniqueOrThrow({ where: { id: result.id } });
      expect(row.status).toBe("DISPUTED");
      expect(await db.pointsEntry.count()).toBe(0);
      const other = await db.swimResult.findUniqueOrThrow({ where: { id: elsewhere.id } });
      expect(other.status).toBe(status);
    },
  );

  it.each(["VERIFIED", "FLAGGED", "REVOKED"] as const)(
    "refuses a %s result with NOT_DISPUTABLE",
    async (status) => {
      const { player, result } = await setup(status);
      const raise = raiseDispute(player.id, result.id, "please");
      await expect(raise).rejects.toBeInstanceOf(NotDisputableError);
      await expect(raise).rejects.toMatchObject({ status: 409, code: "NOT_DISPUTABLE" });
      expect(await db.dispute.count()).toBe(0);
    },
  );

  it("refuses a second open dispute with DISPUTE_OPEN", async () => {
    const { player, result } = await setup();
    await raiseDispute(player.id, result.id, "first");

    const again = raiseDispute(player.id, result.id, "second");
    await expect(again).rejects.toBeInstanceOf(DisputeOpenError);
    await expect(again).rejects.toMatchObject({ status: 409, code: "DISPUTE_OPEN" });
    expect(await db.dispute.count()).toBe(1);
  });

  it("lets only one of two concurrent raises win", async () => {
    const { player, result } = await setup();
    const outcomes = await Promise.allSettled([
      raiseDispute(player.id, result.id, "one"),
      raiseDispute(player.id, result.id, "two"),
    ]);
    expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
    expect(await db.dispute.count()).toBe(1);
  });

  it("refuses anyone but the owner, including the organizer", async () => {
    const { organizer, otherOrganizer, result } = await setup();
    for (const actor of [organizer.id, otherOrganizer.id, ""]) {
      await expect(raiseDispute(actor, result.id, "mine")).rejects.toBeInstanceOf(ForbiddenError);
    }
    const row = await db.swimResult.findUniqueOrThrow({ where: { id: result.id } });
    expect(row.status).toBe("REJECTED");
    expect(await db.dispute.count()).toBe(0);
  });

  it.each([undefined, "", "   ", "x".repeat(301), 42])(
    "refuses a raise without a valid reason (%s)",
    async (reason) => {
      const { player, result } = await setup();
      await expect(raiseDispute(player.id, result.id, reason as string)).rejects.toBeInstanceOf(
        ReasonRequiredError,
      );
      expect(await db.dispute.count()).toBe(0);
    },
  );

  it("gives NotFoundError for an unknown or malformed result id", async () => {
    const { player } = await setup();
    for (const id of ["missing", "", 7]) {
      await expect(raiseDispute(player.id, id as string, "why")).rejects.toBeInstanceOf(
        NotFoundError,
      );
    }
  });
});

describe("decideDispute", () => {
  it("accepts: result VERIFIED with points, dispute closed, audited and emitted", async () => {
    const { organizer, player, cup, result, elsewhere } = await setup();
    const { disputeId } = await raiseDispute(player.id, result.id, "I swam it");

    const out = await decideDispute(
      organizer.id,
      disputeId,
      { accept: true, reason: " Track looks fine " },
      later,
    );

    expect(out).toEqual({ disputeId, resultId: result.id, status: "VERIFIED" });
    const dispute = await db.dispute.findUniqueOrThrow({ where: { id: disputeId } });
    expect(dispute).toMatchObject({
      status: "ACCEPTED",
      decidedById: organizer.id,
      decidedAt: later,
      decisionNote: "Track looks fine",
    });
    const row = await db.swimResult.findUniqueOrThrow({ where: { id: result.id } });
    expect(row.status).toBe("VERIFIED");
    const distance = await db.pointsEntry.findUnique({
      where: { swimResultId_kind: { swimResultId: result.id, kind: "DISTANCE" } },
    });
    expect(distance).toMatchObject({ teamId: cup.team.id, userId: player.id, countedM: 1000 });
    expect(distance!.points).toBeGreaterThan(0);

    const audit = await db.auditEvent.findMany({ where: { action: "DISPUTE_DECIDED" } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actorType: "USER",
      actorUserId: organizer.id,
      entityType: "Dispute",
      entityId: disputeId,
      tournamentId: cup.t.id,
      before: { status: "OPEN", resultStatus: "DISPUTED" },
      after: { status: "ACCEPTED", resultStatus: "VERIFIED" },
      reason: "Track looks fine",
    });
    const events = await db.domainEvent.findMany({ where: { type: "SWIM_RESULT_CHANGED" } });
    expect(events).toHaveLength(1);
    expect(events[0]!.payload).toMatchObject({
      resultId: result.id,
      tournamentId: cup.t.id,
      userId: player.id,
      status: "VERIFIED",
      previousStatus: "DISPUTED",
    });

    const other = await db.swimResult.findUniqueOrThrow({ where: { id: elsewhere.id } });
    expect(other.status).toBe("REJECTED");
    expect(await db.pointsEntry.count({ where: { swimResultId: elsewhere.id } })).toBe(0);
  });

  it("rejects: result back to its earlier status, no points, dispute closed", async () => {
    const { organizer, player, result } = await setup("DUPLICATE");
    const { disputeId } = await raiseDispute(player.id, result.id, "Not a duplicate");

    const out = await decideDispute(
      organizer.id,
      disputeId,
      { accept: false, reason: "Same file" },
      later,
    );

    expect(out).toEqual({ disputeId, resultId: result.id, status: "DUPLICATE" });
    const row = await db.swimResult.findUniqueOrThrow({ where: { id: result.id } });
    expect(row.status).toBe("DUPLICATE");
    const dispute = await db.dispute.findUniqueOrThrow({ where: { id: disputeId } });
    expect(dispute).toMatchObject({
      status: "REJECTED",
      decidedById: organizer.id,
      decidedAt: later,
      decisionNote: "Same file",
    });
    expect(await db.pointsEntry.count()).toBe(0);
    const [audit] = await db.auditEvent.findMany({ where: { action: "DISPUTE_DECIDED" } });
    expect(audit).toMatchObject({
      after: { status: "REJECTED", resultStatus: "DUPLICATE" },
      reason: "Same file",
    });
    const [event] = await db.domainEvent.findMany({ where: { type: "SWIM_RESULT_CHANGED" } });
    expect(event!.payload).toMatchObject({ status: "DUPLICATE", previousStatus: "DISPUTED" });
  });

  it("allows a new dispute after a rejected one", async () => {
    const { organizer, player, result } = await setup();
    const first = await raiseDispute(player.id, result.id, "one");
    await decideDispute(organizer.id, first.disputeId, { accept: false, reason: "no" }, later);

    await raiseDispute(player.id, result.id, "two");
    expect(await db.dispute.count({ where: { swimResultId: result.id } })).toBe(2);
  });

  it("refuses deciding twice with ALREADY_DECIDED", async () => {
    const { organizer, player, result } = await setup();
    const { disputeId } = await raiseDispute(player.id, result.id, "I swam it");
    await decideDispute(organizer.id, disputeId, { accept: true, reason: "ok" }, later);

    const again = decideDispute(organizer.id, disputeId, { accept: false, reason: "no" }, later);
    await expect(again).rejects.toBeInstanceOf(AlreadyDecidedError);
    const row = await db.swimResult.findUniqueOrThrow({ where: { id: result.id } });
    expect(row.status).toBe("VERIFIED");
    expect(await db.auditEvent.count({ where: { action: "DISPUTE_DECIDED" } })).toBe(1);
  });

  it("refuses a non-reviewer, including the owner and the other tournament's organizer", async () => {
    const { otherOrganizer, player, result } = await setup();
    const { disputeId } = await raiseDispute(player.id, result.id, "I swam it");
    for (const actor of [player.id, otherOrganizer.id, ""]) {
      await expect(
        decideDispute(actor, disputeId, { accept: true, reason: "ok" }, later),
      ).rejects.toBeInstanceOf(ForbiddenError);
    }
    const row = await db.swimResult.findUniqueOrThrow({ where: { id: result.id } });
    expect(row.status).toBe("DISPUTED");
    expect(await db.auditEvent.count()).toBe(0);
  });

  it.each([undefined, "", "   ", "x".repeat(301)])(
    "refuses a decision without a valid reason (%s)",
    async (reason) => {
      const { organizer, player, result } = await setup();
      const { disputeId } = await raiseDispute(player.id, result.id, "I swam it");
      for (const accept of [true, false]) {
        await expect(
          decideDispute(organizer.id, disputeId, { accept, reason: reason as string }, later),
        ).rejects.toBeInstanceOf(ReasonRequiredError);
      }
      const dispute = await db.dispute.findUniqueOrThrow({ where: { id: disputeId } });
      expect(dispute.status).toBe("OPEN");
    },
  );

  it("waits for the player's swims lock, the same lock order as an upload", async () => {
    const { organizer, player, result } = await setup();
    const { disputeId } = await raiseDispute(player.id, result.id, "I swam it");
    let settled = false;
    let pending: Promise<unknown> | undefined;

    await db.$transaction(async (tx) => {
      await lockPlayerSwims(tx, player.id);
      pending = decideDispute(
        organizer.id,
        disputeId,
        { accept: true, reason: "ok" },
        later,
      ).finally(() => (settled = true));
      await new Promise((r) => setTimeout(r, 300));
      expect(settled).toBe(false);
    });
    await expect(pending).resolves.toMatchObject({ status: "VERIFIED" });
  });

  it("gives NotFoundError for an unknown or malformed dispute id", async () => {
    const { organizer } = await setup();
    for (const id of ["missing", "", 7]) {
      await expect(
        decideDispute(organizer.id, id as string, { accept: true, reason: "ok" }, later),
      ).rejects.toBeInstanceOf(NotFoundError);
    }
  });
});
