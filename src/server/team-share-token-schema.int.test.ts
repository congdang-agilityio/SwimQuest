import { Prisma } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";

async function clean() {
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}

async function setup() {
  const organizer = await db.user.create({
    data: { email: "organizer@example.com", passwordHash: "hash", displayName: "Organizer" },
  });
  const tournament = await db.tournament.create({
    data: {
      organizerId: organizer.id,
      name: "Summer Swim",
      description: "A season of swimming",
      seasonStartAt: new Date("2026-11-01T00:00:00+07:00"),
      seasonEndAt: new Date("2026-12-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 1650000,
    },
  });
  return tournament;
}

const team = (tournamentId: string, name: string, shareToken?: string) =>
  db.team.create({
    data: { tournamentId, name, emblemKey: "dolphin", memberLimit: 5, shareToken },
  });

describe("Team.shareToken", () => {
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("allows null on many teams", async () => {
    const t = await setup();
    const a = await team(t.id, "A");
    const b = await team(t.id, "B");
    expect(a.shareToken).toBeNull();
    expect(b.shareToken).toBeNull();
  });

  it("rejects two teams sharing one token", async () => {
    const t = await setup();
    await team(t.id, "A", "tok-1");
    const err = await team(t.id, "B", "tok-1").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((err as Prisma.PrismaClientKnownRequestError).code).toBe("P2002");
  });
});
