import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError, NotFoundError } from "@/server/auth/roles";
import { db } from "@/server/db";
import { createTeam, deleteTeam, listTeamsWithCounts, TeamRuleError, updateTeam } from "./manage";

async function clean() {
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}

const user = (n: string) =>
  db.user.create({ data: { email: `${n}@example.com`, passwordHash: "h", displayName: n } });

const tournamentFor = (organizerId: string, status: "DRAFT" | "PUBLISHED" = "DRAFT") =>
  db.tournament.create({
    data: {
      organizerId,
      status,
      name: "Cup",
      description: "d",
      seasonStartAt: new Date("2026-11-01T00:00:00+07:00"),
      seasonEndAt: new Date("2026-12-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100000,
    },
  });

const input = { name: "Sharks", emblemKey: "dolphin", description: "Fast", memberLimit: 3 };

async function setup() {
  const organizer = await user("organizer");
  const outsider = await user("outsider");
  const tournament = await tournamentFor(organizer.id);
  return { organizer, outsider, tournament };
}

async function addMembers(teamId: string, tournamentId: string, n: number, status = "ACTIVE") {
  for (let i = 0; i < n; i++) {
    const u = await user(`m-${teamId}-${status}-${i}`);
    await db.teamMember.create({
      data: { teamId, tournamentId, userId: u.id, status: status as "ACTIVE" | "LEFT" },
    });
  }
}

const ruleError = (code: string) => expect.objectContaining({ code, status: 409 });

describe("team management service", () => {
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  describe("createTeam", () => {
    it("creates a validated team in the organizer's tournament", async () => {
      const { organizer, tournament } = await setup();
      const result = await createTeam(organizer.id, tournament.id, { ...input, name: " Sharks " });
      expect(result).toMatchObject({ ok: true, team: { ...input, tournamentId: tournament.id } });
      expect(await db.team.count({ where: { tournamentId: tournament.id } })).toBe(1);
    });

    it("ignores fields outside the form, such as a captain", async () => {
      const { organizer, outsider, tournament } = await setup();
      const result = await createTeam(organizer.id, tournament.id, {
        ...input,
        captainUserId: outsider.id,
      });
      expect(result.ok && result.team.captainUserId).toBeNull();
    });

    it("returns field errors and stores nothing for invalid input", async () => {
      const { organizer, tournament } = await setup();
      const result = await createTeam(organizer.id, tournament.id, { ...input, memberLimit: 0 });
      expect(result).toEqual({ ok: false, errors: { memberLimit: "LIMIT_INVALID" } });
      expect(await db.team.count()).toBe(0);
    });

    it("refuses a non-organizer with FORBIDDEN before validating", async () => {
      const { outsider, tournament } = await setup();
      await expect(createTeam(outsider.id, tournament.id, input)).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      await expect(createTeam(outsider.id, tournament.id, {})).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      expect(await db.team.count()).toBe(0);
    });

    it("throws NotFoundError for an unknown tournament", async () => {
      const { organizer } = await setup();
      await expect(createTeam(organizer.id, "missing", input)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe("updateTeam", () => {
    it("updates name, emblem, description and limit", async () => {
      const { organizer, tournament } = await setup();
      const created = await createTeam(organizer.id, tournament.id, input);
      const id = created.ok ? created.team.id : "";
      const next = { name: "Whales", emblemKey: "wave", description: null, memberLimit: 1 };
      expect(await updateTeam(organizer.id, id, next)).toMatchObject({ ok: true, team: next });
      expect(await db.team.findUnique({ where: { id } })).toMatchObject(next);
    });

    it("allows a limit equal to the active members, ignoring members who left", async () => {
      const { organizer, tournament } = await setup();
      const team = await db.team.create({ data: { ...input, tournamentId: tournament.id } });
      await addMembers(team.id, tournament.id, 2);
      await addMembers(team.id, tournament.id, 2, "LEFT");
      const result = await updateTeam(organizer.id, team.id, { ...input, memberLimit: 2 });
      expect(result).toMatchObject({ ok: true, team: { memberLimit: 2 } });
    });

    it("refuses a limit below the active member count with LIMIT_BELOW_MEMBERS", async () => {
      const { organizer, tournament } = await setup();
      const team = await db.team.create({ data: { ...input, tournamentId: tournament.id } });
      await addMembers(team.id, tournament.id, 2);
      await expect(
        updateTeam(organizer.id, team.id, { ...input, name: "Changed", memberLimit: 1 }),
      ).rejects.toEqual(ruleError("LIMIT_BELOW_MEMBERS"));
      expect(await db.team.findUnique({ where: { id: team.id } })).toMatchObject({
        name: "Sharks",
        memberLimit: 3,
      });
    });

    it("returns field errors for invalid input", async () => {
      const { organizer, tournament } = await setup();
      const team = await db.team.create({ data: { ...input, tournamentId: tournament.id } });
      const result = await updateTeam(organizer.id, team.id, { ...input, emblemKey: "x" });
      expect(result).toEqual({ ok: false, errors: { emblemKey: "EMBLEM_INVALID" } });
    });

    it("refuses a non-organizer with FORBIDDEN and changes nothing", async () => {
      const { outsider, tournament } = await setup();
      const team = await db.team.create({ data: { ...input, tournamentId: tournament.id } });
      await expect(
        updateTeam(outsider.id, team.id, { ...input, name: "Hijacked" }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect((await db.team.findUnique({ where: { id: team.id } }))?.name).toBe("Sharks");
    });

    it.each([["missing"], [""], [undefined]])("throws NotFoundError for team %j", async (id) => {
      const { organizer } = await setup();
      await expect(updateTeam(organizer.id, id as string, input)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe("deleteTeam", () => {
    it("deletes an empty team while the tournament is a draft", async () => {
      const { organizer, tournament } = await setup();
      const team = await db.team.create({ data: { ...input, tournamentId: tournament.id } });
      await deleteTeam(organizer.id, team.id);
      expect(await db.team.count()).toBe(0);
    });

    it("refuses a team with active members with TEAM_NOT_DELETABLE", async () => {
      const { organizer, tournament } = await setup();
      const team = await db.team.create({ data: { ...input, tournamentId: tournament.id } });
      await addMembers(team.id, tournament.id, 1);
      await expect(deleteTeam(organizer.id, team.id)).rejects.toEqual(
        ruleError("TEAM_NOT_DELETABLE"),
      );
      expect(await db.team.count()).toBe(1);
    });

    it("refuses an empty team once the tournament is published", async () => {
      const { organizer } = await setup();
      const published = await tournamentFor(organizer.id, "PUBLISHED");
      const team = await db.team.create({ data: { ...input, tournamentId: published.id } });
      await expect(deleteTeam(organizer.id, team.id)).rejects.toEqual(
        ruleError("TEAM_NOT_DELETABLE"),
      );
      expect(await db.team.count()).toBe(1);
    });

    it("refuses a non-organizer with FORBIDDEN and keeps the team", async () => {
      const { outsider, tournament } = await setup();
      const team = await db.team.create({ data: { ...input, tournamentId: tournament.id } });
      await expect(deleteTeam(outsider.id, team.id)).rejects.toBeInstanceOf(ForbiddenError);
      expect(await db.team.count()).toBe(1);
    });

    it("throws NotFoundError for an unknown team", async () => {
      const { organizer } = await setup();
      await expect(deleteTeam(organizer.id, "missing")).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("listTeamsWithCounts", () => {
    it("returns each team with its active member count and limit, and the capacity", async () => {
      const { tournament, organizer } = await setup();
      const a = await db.team.create({ data: { ...input, tournamentId: tournament.id } });
      const b = await db.team.create({
        data: { ...input, name: "Solo", memberLimit: 1, tournamentId: tournament.id },
      });
      await addMembers(a.id, tournament.id, 2);
      await addMembers(a.id, tournament.id, 1, "LEFT");
      const other = await tournamentFor(organizer.id);
      await db.team.create({ data: { ...input, memberLimit: 50, tournamentId: other.id } });

      const result = await listTeamsWithCounts(tournament.id);
      expect(result.capacity).toBe(4);
      expect(result.teams).toEqual([
        expect.objectContaining({ id: a.id, name: "Sharks", memberCount: 2, memberLimit: 3 }),
        expect.objectContaining({ id: b.id, name: "Solo", memberCount: 0, memberLimit: 1 }),
      ]);
    });

    it("returns no teams and zero capacity for an empty or invalid tournament id", async () => {
      const { tournament } = await setup();
      expect(await listTeamsWithCounts(tournament.id)).toEqual({ teams: [], capacity: 0 });
      expect(await listTeamsWithCounts(undefined as unknown as string)).toEqual({
        teams: [],
        capacity: 0,
      });
    });
  });

  it("exposes rule errors as TeamRuleError", () => {
    expect(new TeamRuleError("LIMIT_BELOW_MEMBERS")).toBeInstanceOf(Error);
  });
});
