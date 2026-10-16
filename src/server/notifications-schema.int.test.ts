import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";

async function clean() {
  await db.notification.deleteMany();
  await db.pushSubscription.deleteMany();
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

describe("notifications and push schema", () => {
  beforeEach(clean);

  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("turns all four push categories on for a new user", async () => {
    const { id } = await createUser();

    const user = await db.user.findUniqueOrThrow({ where: { id } });
    expect(user.pushCategories).toEqual({
      INVITATIONS: true,
      TEAM: true,
      VERIFICATION: true,
      MILESTONES: true,
    });
  });

  it("refuses a second push subscription with the same endpoint", async () => {
    const a = await createUser("a@example.com");
    const b = await createUser("b@example.com");
    const data = { endpoint: "https://push.example/1", p256dh: "k", auth: "a" };
    await db.pushSubscription.create({ data: { ...data, userId: a.id } });

    await expect(db.pushSubscription.create({ data: { ...data, userId: b.id } })).rejects.toThrow();
  });

  it("stores an unread, unpushed notification and removes it with the user", async () => {
    const user = await createUser();

    const n = await db.notification.create({
      data: {
        userId: user.id,
        category: "TEAM",
        type: "team.joined",
        params: { teamName: "Otters" },
        link: "/team",
      },
    });
    expect(n).toMatchObject({ readAt: null, pushedAt: null, params: { teamName: "Otters" } });

    await db.user.delete({ where: { id: user.id } });
    expect(await db.notification.count()).toBe(0);
  });

  it("starts a tournament without a processed start-lock marker", async () => {
    const organizer = await createUser();
    const t = await db.tournament.create({
      data: {
        organizerId: organizer.id,
        name: "Cup",
        description: "d",
        seasonStartAt: new Date("2027-01-01T00:00:00Z"),
        seasonEndAt: new Date("2027-03-01T00:00:00Z"),
        routeId: "route01",
        routeDistanceM: 100000,
      },
    });
    expect(t.startLockProcessedAt).toBeNull();
  });
});
