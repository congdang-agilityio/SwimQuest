import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";

async function clean() {
  await db.report.deleteMany();
  await db.tournamentQuotaRequest.deleteMany();
  await db.platformSetting.deleteMany();
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

function createUser(email = "player@example.com") {
  return db.user.create({ data: { email, passwordHash: "hash", displayName: "Player" } });
}

describe("platform settings, quota requests and reports schema", () => {
  beforeEach(clean);

  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("gives an existing user no extra quota and no forced password change", async () => {
    const { id } = await createUser();

    const user = await db.user.findUniqueOrThrow({ where: { id } });
    expect(user).toMatchObject({ extraTournamentQuota: 0, mustChangePassword: false });
  });

  it("stores a platform setting as JSON keyed by name", async () => {
    const admin = await createUser("admin@example.com");

    await db.platformSetting.create({
      data: { key: "tournamentQuota", value: { perUser: 3 }, updatedById: admin.id },
    });

    const setting = await db.platformSetting.findUniqueOrThrow({
      where: { key: "tournamentQuota" },
    });
    expect(setting).toMatchObject({ value: { perUser: 3 }, updatedById: admin.id });
    expect(setting.updatedAt).toBeInstanceOf(Date);
  });

  it("refuses a second pending quota request for the same user", async () => {
    const user = await createUser();
    await db.tournamentQuotaRequest.create({ data: { userId: user.id, reason: "League" } });

    await expect(
      db.tournamentQuotaRequest.create({ data: { userId: user.id, reason: "Again" } }),
    ).rejects.toThrow();
  });

  it("allows a new pending request once the earlier one is decided", async () => {
    const user = await createUser();
    const admin = await createUser("admin@example.com");
    const first = await db.tournamentQuotaRequest.create({
      data: { userId: user.id, reason: "League" },
    });
    expect(first.status).toBe("PENDING");

    await db.tournamentQuotaRequest.update({
      where: { id: first.id },
      data: {
        status: "REJECTED",
        decidedById: admin.id,
        decidedAt: new Date(),
        decisionReason: "Too many",
      },
    });

    const second = await db.tournamentQuotaRequest.create({
      data: { userId: user.id, reason: "Club event" },
    });
    expect(second.status).toBe("PENDING");
  });

  it("stores an open report about a target with an internal note", async () => {
    const reporter = await createUser();
    const admin = await createUser("admin@example.com");

    const report = await db.report.create({
      data: { reporterId: reporter.id, targetType: "TEAM", targetId: "team-1", text: "Rude name" },
    });
    expect(report).toMatchObject({ status: "OPEN", note: null, handledById: null });

    const handled = await db.report.update({
      where: { id: report.id },
      data: { status: "HANDLED", note: "Renamed", handledById: admin.id, handledAt: new Date() },
    });
    expect(handled).toMatchObject({ status: "HANDLED", note: "Renamed" });
  });
});
