import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  ForbiddenError,
  isOrganizer,
  NotFoundError,
  requireCaptain,
  requireOrganizer,
  requireOrganizerOrAdmin,
  requirePlatformAdmin,
  requireReviewer,
  roleErrorResponse,
} from "./roles";

async function clean() {
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.auditEvent.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}

const user = (n: string, isPlatformAdmin = false) =>
  db.user.create({
    data: { email: `${n}@example.com`, passwordHash: "h", displayName: n, isPlatformAdmin },
  });

async function setup() {
  const organizer = await user("organizer");
  const captain = await user("captain");
  const member = await user("member");
  const outsider = await user("outsider");
  const tournament = await db.tournament.create({
    data: {
      organizerId: organizer.id,
      name: "Cup",
      description: "d",
      seasonStartAt: new Date("2026-11-01T00:00:00+07:00"),
      seasonEndAt: new Date("2026-12-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100000,
    },
  });
  const team = await db.team.create({
    data: {
      tournamentId: tournament.id,
      name: "Sharks",
      emblemKey: "dolphin",
      memberLimit: 5,
      captainUserId: captain.id,
    },
  });
  for (const u of [captain, member]) {
    await db.teamMember.create({
      data: { tournamentId: tournament.id, teamId: team.id, userId: u.id },
    });
  }
  return { organizer, captain, member, outsider, tournament, team };
}

describe("role guards", () => {
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  describe("requireOrganizer / isOrganizer", () => {
    it("returns the tournament for its organizer", async () => {
      const { organizer, tournament } = await setup();
      await expect(requireOrganizer(organizer.id, tournament.id)).resolves.toMatchObject({
        id: tournament.id,
      });
      expect(await isOrganizer(organizer.id, tournament.id)).toBe(true);
    });

    it("refuses another player, even a captain of the tournament", async () => {
      const { captain, outsider, tournament } = await setup();
      for (const u of [captain, outsider]) {
        await expect(requireOrganizer(u.id, tournament.id)).rejects.toBeInstanceOf(ForbiddenError);
        expect(await isOrganizer(u.id, tournament.id)).toBe(false);
      }
    });

    it("throws NotFoundError for an unknown tournament", async () => {
      const { organizer } = await setup();
      await expect(requireOrganizer(organizer.id, "missing")).rejects.toBeInstanceOf(NotFoundError);
      expect(await isOrganizer(organizer.id, "missing")).toBe(false);
    });

    it.each([[""], [undefined], [42]])("rejects an invalid id %j", async (bad) => {
      const { organizer, tournament } = await setup();
      await expect(requireOrganizer(organizer.id, bad as string)).rejects.toBeInstanceOf(
        NotFoundError,
      );
      await expect(requireOrganizer(bad as string, tournament.id)).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      expect(await isOrganizer(bad as string, tournament.id)).toBe(false);
    });
  });

  describe("requireOrganizerOrAdmin", () => {
    it("returns the tournament for its organizer and for a platform admin", async () => {
      const { organizer, tournament } = await setup();
      const admin = await user("admin", true);
      for (const u of [organizer, admin]) {
        await expect(requireOrganizerOrAdmin(u, tournament.id)).resolves.toMatchObject({
          id: tournament.id,
        });
      }
    });

    it("refuses another player, even a captain, and no user", async () => {
      const { captain, outsider, tournament } = await setup();
      for (const u of [captain, outsider, null]) {
        await expect(requireOrganizerOrAdmin(u, tournament.id)).rejects.toBeInstanceOf(
          ForbiddenError,
        );
      }
    });

    it("throws NotFoundError for an unknown tournament, also for an admin", async () => {
      const admin = await user("admin", true);
      for (const id of ["missing", ""]) {
        await expect(requireOrganizerOrAdmin(admin, id)).rejects.toBeInstanceOf(NotFoundError);
      }
    });
  });

  describe("requireReviewer", () => {
    it("accepts the organizer and refuses players and outsiders", async () => {
      const { organizer, captain, member, outsider, tournament } = await setup();
      await expect(requireReviewer(organizer.id, tournament.id)).resolves.toMatchObject({
        id: tournament.id,
      });
      for (const u of [captain, member, outsider]) {
        await expect(requireReviewer(u.id, tournament.id)).rejects.toBeInstanceOf(ForbiddenError);
      }
      await expect(requireReviewer(organizer.id, "missing")).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("requireCaptain", () => {
    it("returns the team for its captain who is an active member", async () => {
      const { captain, team } = await setup();
      await expect(requireCaptain(captain.id, team.id)).resolves.toMatchObject({ id: team.id });
    });

    it("refuses a plain member, an outsider and the organizer", async () => {
      const { organizer, member, outsider, team } = await setup();
      for (const u of [member, outsider, organizer]) {
        await expect(requireCaptain(u.id, team.id)).rejects.toBeInstanceOf(ForbiddenError);
      }
    });

    it.each([[null], [undefined], [""]])(
      "refuses an invalid user id %j on a team without a captain",
      async (bad) => {
        const { team } = await setup();
        await db.team.update({ where: { id: team.id }, data: { captainUserId: null } });
        await expect(requireCaptain(bad as string, team.id)).rejects.toBeInstanceOf(ForbiddenError);
      },
    );

    it("refuses a captain who is no longer an active member", async () => {
      const { captain, team } = await setup();
      await db.teamMember.updateMany({ where: { userId: captain.id }, data: { status: "LEFT" } });
      await expect(requireCaptain(captain.id, team.id)).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("throws NotFoundError for an unknown team", async () => {
      const { captain } = await setup();
      await expect(requireCaptain(captain.id, "missing")).rejects.toBeInstanceOf(NotFoundError);
      await expect(requireCaptain(captain.id, "")).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("requirePlatformAdmin", () => {
    it("accepts a platform admin and refuses a player or no user", async () => {
      const admin = await user("admin", true);
      const player = await user("player");
      expect(() => requirePlatformAdmin(admin)).not.toThrow();
      expect(() => requirePlatformAdmin(player)).toThrow(ForbiddenError);
      expect(() => requirePlatformAdmin(null)).toThrow(ForbiddenError);
    });
  });

  describe("roleErrorResponse", () => {
    it("maps ForbiddenError to 403 FORBIDDEN and NotFoundError to 404 NOT_FOUND", async () => {
      const forbidden = roleErrorResponse(new ForbiddenError());
      const notFound = roleErrorResponse(new NotFoundError());
      expect(forbidden?.status).toBe(403);
      expect((await forbidden?.json()).error.code).toBe("FORBIDDEN");
      expect(notFound?.status).toBe(404);
      expect((await notFound?.json()).error.code).toBe("NOT_FOUND");
      expect(new ForbiddenError().code).toBe("FORBIDDEN");
    });

    it("returns null for any other error", () => {
      expect(roleErrorResponse(new Error("boom"))).toBeNull();
    });
  });
});
