import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";

async function clean() {
  await db.zaloSwimPost.deleteMany();
  await db.zaloMessage.deleteMany();
  await db.tournamentZalo.deleteMany();
  await db.zaloBot.deleteMany();
  await db.pointsEntry.deleteMany();
  await db.swimResult.deleteMany();
  await db.swim.deleteMany();
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}

function createUser(email = "organizer@example.com") {
  return db.user.create({ data: { email, passwordHash: "hash", displayName: "Organizer" } });
}

function createTournament(organizerId: string) {
  return db.tournament.create({
    data: {
      organizerId,
      name: "Cup",
      description: "d",
      seasonStartAt: new Date("2027-01-01T00:00:00Z"),
      seasonEndAt: new Date("2027-03-01T00:00:00Z"),
      routeId: "route01",
      routeDistanceM: 100000,
    },
  });
}

function createBot(ownerUserId: string, botId = "zalo-bot-1", hookId = "hook-1") {
  return db.zaloBot.create({
    data: {
      ownerUserId,
      botId,
      botName: "Cup bot",
      tokenEnc: "enc:token",
      tokenHint: "abcd",
      hookId,
      secretEnc: "enc:secret",
      origin: "https://swimquest.example",
    },
  });
}

async function createSwimResult(userId: string, tournamentId: string) {
  const team = await db.team.create({
    data: { tournamentId, name: "Otters", emblemKey: "otter", memberLimit: 5 },
  });
  const swim = await db.swim.create({
    data: {
      userId,
      source: "GPX",
      fileSha256: "a".repeat(64),
      originalFilename: "swim.gpx",
      startedAt: new Date("2027-01-02T06:00:00Z"),
      endedAt: new Date("2027-01-02T06:30:00Z"),
      distanceM: 1500,
      durationS: 1800,
      swimType: "POOL",
      sport: "swimming",
      isSwim: true,
    },
  });
  return db.swimResult.create({
    data: {
      swimId: swim.id,
      tournamentId,
      teamId: team.id,
      userId,
      status: "VERIFIED",
      reasons: [],
      countedM: 1500,
    },
  });
}

describe("Zalo schema", () => {
  beforeEach(clean);

  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("stores a bot with an unlinked group and no errors", async () => {
    const owner = await createUser();

    const bot = await createBot(owner.id);
    expect(bot).toMatchObject({
      webhookOk: false,
      chatId: null,
      linkedAt: null,
      lastError: null,
      lastErrorAt: null,
    });
  });

  it("refuses the same Zalo bot twice for one owner but allows it for another", async () => {
    const a = await createUser("a@example.com");
    const b = await createUser("b@example.com");
    await createBot(a.id, "zalo-bot-1", "hook-1");

    await expect(createBot(a.id, "zalo-bot-1", "hook-2")).rejects.toThrow();
    await expect(createBot(b.id, "zalo-bot-1", "hook-3")).resolves.toBeDefined();
  });

  it("refuses a duplicate webhook hook id", async () => {
    const a = await createUser("a@example.com");
    await createBot(a.id, "zalo-bot-1", "hook-1");

    await expect(createBot(a.id, "zalo-bot-2", "hook-1")).rejects.toThrow();
  });

  it("turns every tournament switch on by default", async () => {
    const owner = await createUser();
    const t = await createTournament(owner.id);
    const bot = await createBot(owner.id);

    const settings = await db.tournamentZalo.create({
      data: { tournamentId: t.id, zaloBotId: bot.id },
    });
    expect(settings).toMatchObject({
      notifyNewTeam: true,
      notifyPlayerJoined: true,
      notifyPlayerMoved: true,
      notifySeasonStart: true,
      notifyCountedSwims: true,
      notifyMilestones: true,
      notifySeasonEnd: true,
      introPostedAt: null,
    });

    await db.tournament.delete({ where: { id: t.id } });
    expect(await db.tournamentZalo.count()).toBe(0);
  });

  it("queues a pending message and refuses a duplicate dedupe key", async () => {
    const owner = await createUser();
    const bot = await createBot(owner.id);
    const data = {
      zaloBotId: bot.id,
      chatId: "chat-1",
      kind: "NEW_TEAM" as const,
      payload: { teamId: "t1" },
      groupKey: "team:t1",
      dedupeKey: "NEW_TEAM:t1",
    };

    const message = await db.zaloMessage.create({ data });
    expect(message).toMatchObject({ status: "PENDING", attempts: 0, sentAt: null });

    await expect(db.zaloMessage.create({ data })).rejects.toThrow();
    await expect(
      db.zaloMessage.create({ data: { ...data, dedupeKey: null } }),
    ).resolves.toMatchObject({ groupKey: "team:t1" });
  });

  it("posts a counted swim result at most once", async () => {
    const owner = await createUser();
    const t = await createTournament(owner.id);
    const bot = await createBot(owner.id);
    const result = await createSwimResult(owner.id, t.id);
    const message = await db.zaloMessage.create({
      data: { zaloBotId: bot.id, chatId: "chat-1", kind: "COUNTED_SWIM", payload: {} },
    });

    await db.zaloSwimPost.create({ data: { swimResultId: result.id, zaloMessageId: message.id } });
    await expect(
      db.zaloSwimPost.create({ data: { swimResultId: result.id, zaloMessageId: message.id } }),
    ).rejects.toThrow();
  });

  it("starts a tournament without a processed season-start marker", async () => {
    const owner = await createUser();
    const t = await createTournament(owner.id);
    expect(t.seasonStartProcessedAt).toBeNull();
  });
});
