import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { AUDIT_ACTIONS, type AuditAction } from "@/server/audit/record";
import { decideDispute, raiseDispute } from "@/server/review/disputes";
import { decideFlagged } from "@/server/review/decide";
import { revokeResult } from "@/server/review/revoke";
import { movePlayer } from "@/server/teams/move-player";
import { appointCaptain, handOverCaptaincy } from "@/server/teams/captain";
import { organizerSetStart } from "@/server/starts/organizer-start";
import { correctStart } from "./start-correction";
import { reactivateUser, suspendUser } from "./account-status";
import { setPlatformAdmin } from "./users";
import { getAuditEvent, listAuditEvents, type AuditEventRow } from "./audit-log";

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

const user = (n: string, isPlatformAdmin = false) =>
  db.user.create({
    data: { email: `${n}@example.com`, passwordHash: "h", displayName: n, isPlatformAdmin },
  });

let seq = 0;
async function flaggedSwim(playerId: string, day: string, t: { id: string }, teamId: string) {
  seq += 1;
  const swim = await db.swim.create({
    data: {
      userId: playerId,
      source: "GPX",
      fileSha256: seq.toString(16).padStart(64, "0"),
      originalFilename: `swim-${seq}.gpx`,
      startedAt: new Date(`${day}T06:00:00+07:00`),
      endedAt: new Date(`${day}T06:55:00+07:00`),
      distanceM: 1000,
      durationS: 3300,
      swimType: "OPEN_WATER",
      sport: "swimming",
      isSwim: true,
    },
  });
  return db.swimResult.create({
    data: {
      swimId: swim.id,
      tournamentId: t.id,
      teamId,
      userId: playerId,
      status: "FLAGGED",
      reasons: ["PACE_TOO_SLOW"],
    },
  });
}

const inSeason = new Date("2026-06-04T10:00:00+07:00");
const beforeLock = new Date("2026-04-01T10:00:00+07:00");

describe("audit log coverage (S-80 AC 5)", () => {
  let events: AuditEventRow[];
  let admin: { id: string; isPlatformAdmin: boolean };
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    await clean();
    const adminUser = await user("admin", true);
    admin = { id: adminUser.id, isPlatformAdmin: true };
    const organizer = await user("organizer");
    const [p1, p2, p3, p4, p5, subject, promoted] = await Promise.all(
      ["p1", "p2", "p3", "p4", "p5", "subject", "promoted"].map((n) => user(n)),
    );
    const t = await db.tournament.create({
      data: {
        organizerId: organizer.id,
        name: "Cup",
        description: "d",
        status: "ACTIVE",
        seasonStartAt: new Date("2026-05-01T00:00:00+07:00"),
        seasonEndAt: new Date("2026-07-01T00:00:00+07:00"),
        routeId: "route01",
        routeDistanceM: 100000,
        dailyLimitM: 1500,
      },
    });
    const team = (name: string) =>
      db.team.create({
        data: { tournamentId: t.id, name, emblemKey: "dolphin", memberLimit: 10 },
      });
    const [teamA, teamB] = [await team("Alpha"), await team("Beta")];
    for (const p of [p1, p2, p3, p4, p5]) {
      await db.teamMember.create({
        data: { tournamentId: t.id, teamId: teamA.id, userId: p.id, status: "ACTIVE" },
      });
    }
    Object.assign(ids, {
      admin: adminUser.id,
      organizer: organizer.id,
      t: t.id,
      teamA: teamA.id,
      teamB: teamB.id,
      p4: p4.id,
      p5: p5.id,
      subject: subject.id,
      promoted: promoted.id,
    });

    // Review decision (#289).
    const reviewed = await flaggedSwim(p1.id, "2026-06-02", t, teamA.id);
    await decideFlagged(organizer.id, reviewed.id, { approve: true }, inSeason);
    ids.reviewed = reviewed.id;
    // Dispute decision (#293): reject, the player disputes, the organizer accepts.
    const disputed = await flaggedSwim(p2.id, "2026-06-02", t, teamA.id);
    await decideFlagged(organizer.id, disputed.id, { approve: false, reason: "Pace" }, inSeason);
    const dispute = await raiseDispute(p2.id, disputed.id, "I swam it");
    await decideDispute(
      organizer.id,
      dispute.disputeId,
      { accept: true, reason: "Fine" },
      inSeason,
    );
    ids.dispute = dispute.disputeId;
    // Revocation (#304).
    const revoked = await flaggedSwim(p3.id, "2026-06-03", t, teamA.id);
    await decideFlagged(organizer.id, revoked.id, { approve: true }, inSeason);
    await revokeResult(organizer.id, revoked.id, "Wrong person", { now: inSeason });
    ids.revoked = revoked.id;
    // Captain appointment (#149) and handover (#314).
    await appointCaptain(organizer.id, teamA.id, p5.id);
    await handOverCaptaincy(p5.id, teamA.id, p1.id);
    // Move (#313).
    await movePlayer(organizer.id, p4.id, teamA.id, teamB.id, inSeason);
    // Organizer start override (#330) before the lock; admin correction (#403) after it.
    await organizerSetStart(organizer.id, teamB.id, "non_nuoc", beforeLock);
    await correctStart(admin, teamB.id, "man_thai", "Organizer mistake", inSeason);
    // Account suspension and reactivation (#247), admin role change (#199).
    await suspendUser(admin, subject.id, "Abuse");
    await reactivateUser(admin, subject.id, "Appeal won");
    await setPlatformAdmin(admin, promoted.id, true);

    const out: AuditEventRow[] = [];
    let cursor: string | undefined;
    do {
      const page = await listAuditEvents(admin, {}, cursor);
      out.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    events = out;
  });
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  const find = (action: AuditAction, entityId: string) => {
    const hits = events.filter((e) => e.action === action && e.entityId === entityId);
    expect(hits, `${action} on ${entityId}`).toHaveLength(1);
    return hits[0];
  };

  type Case = {
    action: AuditAction;
    entity: () => string;
    actor: () => string;
    reason: string | null;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  const cases: Case[] = [
    {
      action: AUDIT_ACTIONS.SWIM_REVIEWED,
      entity: () => ids.reviewed,
      actor: () => ids.organizer,
      reason: null, // an approval needs no reason
      after: { status: "VERIFIED" },
    },
    {
      action: AUDIT_ACTIONS.DISPUTE_DECIDED,
      entity: () => ids.dispute,
      actor: () => ids.organizer,
      reason: "Fine",
      before: { status: "OPEN" },
      after: { status: "ACCEPTED" },
    },
    {
      action: AUDIT_ACTIONS.SWIM_REVOKED,
      entity: () => ids.revoked,
      actor: () => ids.organizer,
      reason: "Wrong person",
      before: { status: "VERIFIED" },
      after: { status: "REVOKED" },
    },
    {
      action: AUDIT_ACTIONS.TEAM_CAPTAIN_SET,
      entity: () => ids.teamA,
      actor: () => ids.organizer,
      reason: null,
      before: { captainUserId: null },
      get after() {
        return { captainUserId: ids.p5 };
      },
    },
    {
      action: AUDIT_ACTIONS.TEAM_CAPTAIN_HANDOVER,
      entity: () => ids.teamA,
      actor: () => ids.p5,
      reason: null,
      get before() {
        return { captainUserId: ids.p5 };
      },
    },
    {
      action: AUDIT_ACTIONS.TEAM_START_SET_BY_ORGANIZER,
      entity: () => ids.teamB,
      actor: () => ids.organizer,
      reason: null,
      after: { startDestination: "non_nuoc" },
    },
    {
      action: AUDIT_ACTIONS.START_CORRECTED_BY_ADMIN,
      entity: () => ids.teamB,
      actor: () => ids.admin,
      reason: "Organizer mistake",
      before: { startDestination: "non_nuoc" },
      after: { startDestination: "man_thai" },
    },
    {
      action: AUDIT_ACTIONS.ACCOUNT_SUSPENDED,
      entity: () => ids.subject,
      actor: () => ids.admin,
      reason: "Abuse",
    },
    {
      action: AUDIT_ACTIONS.ACCOUNT_REACTIVATED,
      entity: () => ids.subject,
      actor: () => ids.admin,
      reason: "Appeal won",
    },
    {
      action: AUDIT_ACTIONS.ADMIN_ROLE_CHANGED,
      entity: () => ids.promoted,
      actor: () => ids.admin,
      reason: null,
      before: { isPlatformAdmin: false },
      after: { isPlatformAdmin: true },
    },
  ];

  for (const c of cases) {
    it(`${c.action} appears with actor, target, time and values`, async () => {
      const row = find(c.action, c.entity());
      expect(row.actor?.id).toBe(c.actor());
      expect(row.entityId).toBe(c.entity());
      expect(Number.isNaN(Date.parse(row.createdAt))).toBe(false);
      expect(row.reason).toBe(c.reason);
      const detail = await getAuditEvent(admin, row.id);
      if (c.before) expect(detail.before).toMatchObject(c.before);
      if (c.after) expect(detail.after).toMatchObject(c.after);
    });
  }

  it("the player move appears with before and after (reason not collected by the service)", async () => {
    const hits = events.filter((e) => e.action === AUDIT_ACTIONS.PLAYER_MOVED);
    expect(hits).toHaveLength(1);
    expect(hits[0].actor?.id).toBe(ids.organizer);
    expect(hits[0].tournamentId).toBe(ids.t);
    const detail = await getAuditEvent(admin, hits[0].id);
    expect(detail.before).toMatchObject({ userId: ids.p4, teamId: ids.teamA });
    expect(detail.after).toMatchObject({ userId: ids.p4, teamId: ids.teamB });
  });

  it("every action that must carry a reason has one", () => {
    const needReason: AuditAction[] = [
      AUDIT_ACTIONS.DISPUTE_DECIDED,
      AUDIT_ACTIONS.SWIM_REVOKED,
      AUDIT_ACTIONS.START_CORRECTED_BY_ADMIN,
      AUDIT_ACTIONS.ACCOUNT_SUSPENDED,
      AUDIT_ACTIONS.ACCOUNT_REACTIVATED,
    ];
    for (const e of events.filter((x) => needReason.includes(x.action as AuditAction))) {
      expect(e.reason, e.action).toBeTruthy();
    }
  });

  it("the log lists newest first and the action filter returns each kind", async () => {
    const times = events.map((e) => Date.parse(e.createdAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
    const page = await listAuditEvents(admin, { actions: [AUDIT_ACTIONS.ADMIN_ROLE_CHANGED] });
    expect(page.items.map((i) => i.action)).toEqual([AUDIT_ACTIONS.ADMIN_ROLE_CHANGED]);
  });
});
