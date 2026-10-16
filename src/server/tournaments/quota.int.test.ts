import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError } from "@/server/auth/roles";
import { createDraft } from "./create";
import {
  assertCanCreateTournament,
  decideRequest,
  getQuota,
  listRequests,
  QuotaError,
  requestMore,
} from "./quota";

const input = {
  name: "Autumn Expedition",
  description: "Swim to Ly Son together",
  seasonStart: { date: "2026-11-01", time: "00:00" },
  seasonEnd: { date: "2026-11-30", time: "23:59" },
  routeId: "route01",
  routeDistanceKm: "123.45",
};

async function makeUser(email: string, data: { isPlatformAdmin?: boolean } = {}) {
  return db.user.create({ data: { email, passwordHash: "hash", displayName: email, ...data } });
}

async function makeTournaments(organizerId: string, count: number) {
  for (let i = 0; i < count; i++) {
    const created = await createDraft(organizerId, input);
    if (!created.ok) throw new Error("draft not created");
  }
}

async function clean() {
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.tournamentQuotaRequest.deleteMany();
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
  await db.session.deleteMany();
  await db.xpEntry.deleteMany();
  await db.user.deleteMany();
}

function barrier(count: number) {
  let arrived = 0;
  let release!: () => void;
  const all = new Promise<void>((resolve) => (release = resolve));
  return () => {
    if (++arrived === count) release();
    return all;
  };
}

const code = (p: Promise<unknown>) =>
  p.then(
    () => "resolved",
    (e: unknown) => (e as { code?: string }).code,
  );

describe("tournament quota", () => {
  beforeEach(clean);

  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  describe("getQuota", () => {
    it("counts every tournament the user created, in any status, against 3 + extra", async () => {
      const user = await makeUser("p@example.com");
      await makeTournaments(user.id, 2);
      await db.tournament.updateMany({ data: { status: "PUBLISHED" }, where: {} });
      await makeTournaments(user.id, 1);
      await db.user.update({ where: { id: user.id }, data: { extraTournamentQuota: 2 } });

      expect(await getQuota(user.id)).toEqual({ used: 3, allowed: 5, request: null });
    });

    it("does not count tournaments organized by someone else", async () => {
      const user = await makeUser("p@example.com");
      const other = await makeUser("o@example.com");
      await makeTournaments(other.id, 2);

      expect(await getQuota(user.id)).toMatchObject({ used: 0, allowed: 3 });
    });

    it("returns the latest request with its status and reasons", async () => {
      const user = await makeUser("p@example.com");
      const admin = await makeUser("a@example.com", { isPlatformAdmin: true });
      await makeTournaments(user.id, 3);
      const first = await requestMore(user.id, "First event");
      await decideRequest(admin, first.id, false, "Too many already");
      const second = await requestMore(user.id, "Club relay");

      const quota = await getQuota(user.id);
      expect(quota.request).toMatchObject({
        id: second.id,
        status: "PENDING",
        reason: "Club relay",
        decisionReason: null,
      });
    });

    it("refuses an unknown user", async () => {
      await expect(code(getQuota("nope"))).resolves.toBe("NOT_FOUND");
    });
  });

  describe("createDraft at the limit", () => {
    it("refuses the fourth tournament with QUOTA_REACHED and stores nothing", async () => {
      const user = await makeUser("p@example.com");
      await makeTournaments(user.id, 3);

      await expect(code(createDraft(user.id, input))).resolves.toBe("QUOTA_REACHED");
      await expect(db.tournament.count()).resolves.toBe(3);
    });

    it("allows one more tournament per approved request", async () => {
      const user = await makeUser("p@example.com");
      await makeTournaments(user.id, 3);
      await db.user.update({ where: { id: user.id }, data: { extraTournamentQuota: 1 } });

      await expect(createDraft(user.id, input)).resolves.toMatchObject({ ok: true });
      await expect(code(createDraft(user.id, input))).resolves.toBe("QUOTA_REACHED");
    });

    it("serializes the check and insert of transactions that start together", async () => {
      const user = await makeUser("p@example.com");
      await makeTournaments(user.id, 2);
      const data = await db.tournament.findFirstOrThrow({
        where: { organizerId: user.id },
        select: {
          organizerId: true,
          name: true,
          description: true,
          seasonStartAt: true,
          seasonEndAt: true,
          routeId: true,
          routeDistanceM: true,
        },
      });

      const arrive = barrier(2);
      const results = await Promise.allSettled(
        [0, 1].map(() =>
          db.$transaction(async (tx) => {
            await arrive();
            await assertCanCreateTournament(tx, user.id);
            await tx.tournament.create({ data });
          }),
        ),
      );

      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      await expect(db.tournament.count({ where: { organizerId: user.id } })).resolves.toBe(3);
    });

    it("never goes over the limit with concurrent creates at 2 used", async () => {
      const user = await makeUser("p@example.com");
      await makeTournaments(user.id, 2);

      const results = await Promise.allSettled(
        Array.from({ length: 8 }, () => createDraft(user.id, input)),
      );

      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      await expect(db.tournament.count({ where: { organizerId: user.id } })).resolves.toBe(3);
    });
  });

  describe("requestMore", () => {
    it("stores a pending request with the trimmed reason at the limit", async () => {
      const user = await makeUser("p@example.com");
      await makeTournaments(user.id, 3);

      const request = await requestMore(user.id, "  Our club runs a winter league  ");

      expect(request).toMatchObject({ status: "PENDING", reason: "Our club runs a winter league" });
      await expect(db.tournamentQuotaRequest.count({ where: { userId: user.id } })).resolves.toBe(
        1,
      );
    });

    it("refuses a request below the limit", async () => {
      const user = await makeUser("p@example.com");
      await makeTournaments(user.id, 2);

      await expect(code(requestMore(user.id, "Need more"))).resolves.toBe("QUOTA_NOT_REACHED");
    });

    it("refuses a second request while one is pending, also concurrently", async () => {
      const user = await makeUser("p@example.com");
      await makeTournaments(user.id, 3);

      const results = await Promise.allSettled([
        requestMore(user.id, "One"),
        requestMore(user.id, "Two"),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      await expect(code(requestMore(user.id, "Three"))).resolves.toBe("REQUEST_PENDING");
      await expect(db.tournamentQuotaRequest.count()).resolves.toBe(1);
    });

    it("refuses an empty or overlong reason", async () => {
      const user = await makeUser("p@example.com");
      await makeTournaments(user.id, 3);

      await expect(code(requestMore(user.id, "   "))).resolves.toBe("INVALID_REASON");
      await expect(code(requestMore(user.id, "x".repeat(501)))).resolves.toBe("INVALID_REASON");
      await expect(code(requestMore(user.id, 42 as unknown as string))).resolves.toBe(
        "INVALID_REASON",
      );
    });
  });

  describe("decideRequest", () => {
    async function pending() {
      const user = await makeUser("p@example.com");
      const admin = await makeUser("a@example.com", { isPlatformAdmin: true });
      await makeTournaments(user.id, 3);
      const request = await requestMore(user.id, "Club relay");
      return { user, admin, request };
    }

    it("approves: one more tournament, decision stored and audited", async () => {
      const { user, admin, request } = await pending();

      const decided = await decideRequest(admin, request.id, true, "");

      expect(decided).toMatchObject({ status: "APPROVED", decisionReason: null });
      const stored = await db.tournamentQuotaRequest.findUniqueOrThrow({
        where: { id: request.id },
      });
      expect(stored).toMatchObject({ status: "APPROVED", decidedById: admin.id });
      expect(stored.decidedAt).toBeInstanceOf(Date);
      expect(await getQuota(user.id)).toMatchObject({ used: 3, allowed: 4 });
      await expect(createDraft(user.id, input)).resolves.toMatchObject({ ok: true });

      const audit = await db.auditEvent.findMany();
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({
        actorType: "USER",
        actorUserId: admin.id,
        action: "QUOTA_REQUEST_DECIDED",
        entityType: "TournamentQuotaRequest",
        entityId: request.id,
        before: { status: "PENDING" },
        after: { decision: "APPROVED", userId: user.id, extraTournamentQuota: 1 },
        reason: null,
      });
      expect(audit[0].createdAt).toBeInstanceOf(Date);
    });

    it("rejects with a reason: quota unchanged, decision and reason audited", async () => {
      const { user, admin, request } = await pending();

      const decided = await decideRequest(admin, request.id, false, " Enough events for now ");

      expect(decided).toMatchObject({
        status: "REJECTED",
        decisionReason: "Enough events for now",
      });
      expect(await getQuota(user.id)).toMatchObject({
        allowed: 3,
        request: { status: "REJECTED", decisionReason: "Enough events for now" },
      });
      await expect(code(createDraft(user.id, input))).resolves.toBe("QUOTA_REACHED");
      const audit = await db.auditEvent.findMany();
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({
        actorUserId: admin.id,
        action: "QUOTA_REQUEST_DECIDED",
        after: { decision: "REJECTED", userId: user.id, extraTournamentQuota: 0 },
        reason: "Enough events for now",
      });
    });

    it("refuses a rejection without a reason and changes nothing", async () => {
      const { admin, request } = await pending();

      await expect(code(decideRequest(admin, request.id, false, "  "))).resolves.toBe(
        "INVALID_REASON",
      );
      await expect(
        db.tournamentQuotaRequest.findUniqueOrThrow({ where: { id: request.id } }),
      ).resolves.toMatchObject({ status: "PENDING" });
      await expect(db.auditEvent.count()).resolves.toBe(0);
    });

    it("decides a request only once, also concurrently", async () => {
      const { user, admin, request } = await pending();

      const results = await Promise.allSettled([
        decideRequest(admin, request.id, true, ""),
        decideRequest(admin, request.id, true, ""),
      ]);

      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      await expect(code(decideRequest(admin, request.id, false, "No"))).resolves.toBe(
        "REQUEST_DECIDED",
      );
      expect(await getQuota(user.id)).toMatchObject({ allowed: 4 });
      await expect(db.auditEvent.count()).resolves.toBe(1);
    });

    it("refuses non-admins, suspended admins and unknown requests", async () => {
      const { user, admin, request } = await pending();
      const suspended = await makeUser("s@example.com", { isPlatformAdmin: true });
      await db.user.update({ where: { id: suspended.id }, data: { status: "SUSPENDED" } });

      await expect(decideRequest(user, request.id, true, "")).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      await expect(
        decideRequest({ id: user.id, isPlatformAdmin: true }, request.id, true, ""),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(decideRequest(suspended, request.id, true, "")).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      await expect(decideRequest(admin, "missing", true, "")).rejects.toBeInstanceOf(NotFoundError);
      await expect(db.auditEvent.count()).resolves.toBe(0);
      expect(await getQuota(user.id)).toMatchObject({ allowed: 3 });
    });
  });

  describe("listRequests", () => {
    it("lists requests by status, newest first, with the player", async () => {
      const admin = await makeUser("a@example.com", { isPlatformAdmin: true });
      const one = await makeUser("one@example.com");
      const two = await makeUser("two@example.com");
      await makeTournaments(one.id, 3);
      await makeTournaments(two.id, 3);
      const r1 = await requestMore(one.id, "First");
      const r2 = await requestMore(two.id, "Second");
      await decideRequest(admin, r1.id, false, "No");

      const pendingList = await listRequests(admin, "PENDING");
      expect(pendingList.map((r) => r.id)).toEqual([r2.id]);
      expect(pendingList[0]).toMatchObject({
        reason: "Second",
        status: "PENDING",
        user: { id: two.id, displayName: "two@example.com" },
      });
      expect((await listRequests(admin, "REJECTED")).map((r) => r.id)).toEqual([r1.id]);
      expect((await listRequests(admin)).map((r) => r.id)).toEqual([r2.id, r1.id]);
    });

    it("refuses non-admins and an unknown status", async () => {
      const user = await makeUser("p@example.com");
      const admin = await makeUser("a@example.com", { isPlatformAdmin: true });

      await expect(listRequests(user, "PENDING")).rejects.toBeInstanceOf(ForbiddenError);
      await expect(code(listRequests(admin, "DONE" as "PENDING"))).resolves.toBe("INVALID_STATUS");
    });
  });

  it("exposes HTTP status and code on quota errors", () => {
    const err = new QuotaError("QUOTA_REACHED");
    expect(err).toMatchObject({ status: 409, code: "QUOTA_REACHED" });
    expect(new QuotaError("INVALID_REASON")).toMatchObject({ status: 400 });
  });
});
