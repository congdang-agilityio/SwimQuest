import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { AUDIT_ACTIONS } from "@/server/audit/record";
import { ForbiddenError, NotFoundError } from "@/server/auth/roles";
import { db } from "@/server/db";
import { appointCaptain, NotAMemberError } from "./captain";
import { getTeamRoster } from "./roster";

async function clean() {
  await db.domainEvent.deleteMany();
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.session.deleteMany();
  await db.xpEntry.deleteMany();
  await db.user.deleteMany();
}

const user = (n: string) =>
  db.user.create({ data: { email: `${n}@example.com`, passwordHash: "h", displayName: n } });

const tournamentFor = (organizerId: string) =>
  db.tournament.create({
    data: {
      organizerId,
      name: "Cup",
      description: "d",
      seasonStartAt: new Date("2026-11-01T00:00:00+07:00"),
      seasonEndAt: new Date("2026-12-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100000,
    },
  });

const teamIn = (tournamentId: string, name = "Sharks") =>
  db.team.create({ data: { tournamentId, name, emblemKey: "dolphin", memberLimit: 5 } });

const join = (
  teamId: string,
  tournamentId: string,
  userId: string,
  status: "ACTIVE" | "LEFT" = "ACTIVE",
  joinedAt = new Date(),
) => db.teamMember.create({ data: { teamId, tournamentId, userId, status, joinedAt } });

async function setup() {
  const organizer = await user("organizer");
  const outsider = await user("outsider");
  const anna = await user("anna");
  const binh = await user("binh");
  const tournament = await tournamentFor(organizer.id);
  const team = await teamIn(tournament.id);
  await join(team.id, tournament.id, anna.id, "ACTIVE", new Date("2026-10-01T00:00:00Z"));
  await join(team.id, tournament.id, binh.id, "ACTIVE", new Date("2026-10-02T00:00:00Z"));
  return { organizer, outsider, anna, binh, tournament, team };
}

const captainOf = async (teamId: string) =>
  (await db.team.findUniqueOrThrow({ where: { id: teamId } })).captainUserId;

describe("team roster and captain appointment", () => {
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  describe("captain events", () => {
    it("emits one TEAM_CAPTAIN_SET per change and none when nothing changed", async () => {
      const { organizer, anna, tournament, team } = await setup();

      await appointCaptain(organizer.id, team.id, anna.id);
      await appointCaptain(organizer.id, team.id, anna.id);

      const events = await db.domainEvent.findMany({ where: { type: "TEAM_CAPTAIN_SET" } });
      expect(events).toHaveLength(1);
      expect(events[0].payload).toEqual({
        tournamentId: tournament.id,
        teamId: team.id,
        userId: anna.id,
        setBy: organizer.id,
      });
    });
  });

  describe("getTeamRoster", () => {
    it("lists active members oldest first as public players with isCaptain and joinedAt", async () => {
      const { outsider, anna, binh, tournament, team } = await setup();
      await join(team.id, tournament.id, outsider.id, "LEFT");
      await db.team.update({ where: { id: team.id }, data: { captainUserId: binh.id } });

      const roster = await getTeamRoster(team.id);

      expect(roster).toEqual([
        {
          id: anna.id,
          displayName: "anna",
          isCaptain: false,
          joinedAt: new Date("2026-10-01T00:00:00Z"),
        },
        {
          id: binh.id,
          displayName: "binh",
          isCaptain: true,
          joinedAt: new Date("2026-10-02T00:00:00Z"),
        },
      ]);
    });

    it("never exposes an email or other private user field", async () => {
      const { team } = await setup();
      const roster = await getTeamRoster(team.id);
      expect(roster).toHaveLength(2);
      for (const member of roster) {
        expect(Object.keys(member).sort()).toEqual(["displayName", "id", "isCaptain", "joinedAt"]);
        expect(JSON.stringify(member)).not.toContain("@example.com");
      }
    });

    it("returns an empty roster for a team without members", async () => {
      const { tournament } = await setup();
      const empty = await teamIn(tournament.id, "Empty");
      expect(await getTeamRoster(empty.id)).toEqual([]);
    });

    it("throws NotFoundError for an unknown or invalid team id", async () => {
      await expect(getTeamRoster("missing")).rejects.toBeInstanceOf(NotFoundError);
      await expect(getTeamRoster("")).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("appointCaptain", () => {
    it("makes an active member captain and records the audit event", async () => {
      const { organizer, anna, tournament, team } = await setup();

      const result = await appointCaptain(organizer.id, team.id, anna.id);

      expect(result).toEqual({ changed: true, captainUserId: anna.id });
      expect(await captainOf(team.id)).toBe(anna.id);
      const events = await db.auditEvent.findMany();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        actorType: "USER",
        actorUserId: organizer.id,
        action: AUDIT_ACTIONS.TEAM_CAPTAIN_SET,
        entityType: "Team",
        entityId: team.id,
        tournamentId: tournament.id,
        before: { captainUserId: null, teamId: team.id, tournamentId: tournament.id },
        after: { captainUserId: anna.id, teamId: team.id, tournamentId: tournament.id },
      });
      expect(events[0]!.createdAt).toBeInstanceOf(Date);
    });

    it("changes the captain: the previous one becomes a normal member", async () => {
      const { organizer, anna, binh, team } = await setup();
      await appointCaptain(organizer.id, team.id, anna.id);

      const result = await appointCaptain(organizer.id, team.id, binh.id);

      expect(result).toEqual({ changed: true, captainUserId: binh.id });
      const roster = await getTeamRoster(team.id);
      expect(roster.map((m) => [m.id, m.isCaptain])).toEqual([
        [anna.id, false],
        [binh.id, true],
      ]);
      const last = await db.auditEvent.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
      expect(last.before).toMatchObject({ captainUserId: anna.id });
      expect(last.after).toMatchObject({ captainUserId: binh.id });
      expect(await db.auditEvent.count()).toBe(2);
    });

    it("appointing the current captain again changes nothing and writes no audit", async () => {
      const { organizer, anna, team } = await setup();
      await appointCaptain(organizer.id, team.id, anna.id);

      const result = await appointCaptain(organizer.id, team.id, anna.id);

      expect(result).toEqual({ changed: false, captainUserId: anna.id });
      expect(await captainOf(team.id)).toBe(anna.id);
      expect(await db.auditEvent.count()).toBe(1);
    });

    it("refuses a user who is not an active member of the team", async () => {
      const { organizer, outsider, tournament, team } = await setup();
      const leaver = await user("leaver");
      await join(team.id, tournament.id, leaver.id, "LEFT");
      const other = await teamIn(tournament.id, "Other");
      const elsewhere = await user("elsewhere");
      await join(other.id, tournament.id, elsewhere.id);

      for (const id of [outsider.id, leaver.id, elsewhere.id, "missing", "", 42 as never]) {
        await expect(appointCaptain(organizer.id, team.id, id)).rejects.toMatchObject({
          code: "NOT_A_MEMBER",
        });
      }
      await expect(appointCaptain(organizer.id, team.id, outsider.id)).rejects.toBeInstanceOf(
        NotAMemberError,
      );
      expect(await captainOf(team.id)).toBeNull();
      expect(await db.auditEvent.count()).toBe(0);
    });

    it("refuses anyone but the tournament's organizer", async () => {
      const { outsider, anna, team } = await setup();

      await expect(appointCaptain(outsider.id, team.id, anna.id)).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      await expect(appointCaptain(anna.id, team.id, anna.id)).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      expect(await captainOf(team.id)).toBeNull();
      expect(await db.auditEvent.count()).toBe(0);
    });

    it("throws NotFoundError for an unknown team", async () => {
      const { organizer, anna } = await setup();
      await expect(appointCaptain(organizer.id, "missing", anna.id)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });
});
