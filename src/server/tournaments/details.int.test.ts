import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  addMember,
  BEFORE_START,
  endedMembership,
  SEASON_END,
  SEASON_START,
  tournamentWithTeams,
  user,
} from "../join/__tests__/fixtures";
import { getTournamentDetails } from "./details";

const AFTER_END = new Date("2026-12-05T00:00:00+07:00");
const DURING = new Date("2026-11-10T00:00:00+07:00");

/** Order: points entries, swim results, swims, members, teams, tournaments, sessions, users. */
async function clean() {
  await db.pointsEntry.deleteMany();
  await db.swimResult.deleteMany();
  await db.swim.deleteMany();
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}

const makePublic = (id: string) =>
  db.tournament.update({ where: { id }, data: { visibility: "PUBLIC" } });

describe("getTournamentDetails", () => {
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("returns the full details of a public tournament to any player, without emails", async () => {
    const { tournament, teams, organizer } = await tournamentWithTeams("PUBLISHED", [2, 1]);
    await db.tournament.update({
      where: { id: tournament.id },
      data: {
        visibility: "PUBLIC",
        rulesText: "Be fair",
        rulesUrl: "https://example.com/rules",
        contactChannel: "zalo group",
        bannerImageId: "banner1",
        logoImageId: "logo1",
        minSwimDistanceM: 500,
        extraSlowestPaceSecPer100m: 240,
      },
    });
    await addMember(teams[1].id, tournament.id, "m1");
    const player = await user("player");

    const details = await getTournamentDetails(player.id, tournament.id, {}, BEFORE_START);

    expect(details).toMatchObject({
      id: tournament.id,
      name: "Cup",
      description: "Swim around the bay",
      organizer: { id: organizer.id, displayName: organizer.displayName },
      status: "PUBLISHED",
      seasonStartAt: SEASON_START,
      seasonEndAt: SEASON_END,
      routeId: "route01",
      routeDistanceM: 100000,
      teams: [
        { id: teams[0].id, name: "Team 0", memberLimit: 2, memberCount: 0, freePlaces: 2 },
        { id: teams[1].id, name: "Team 1", memberLimit: 1, memberCount: 1, freePlaces: 0 },
      ],
      settings: {
        fastestPaceSecPer100m: 65,
        slowestPaceSecPer100m: 300,
        longestRealisticSwimM: 30000,
        longestSwimCountedM: 10000,
        dailyLimitM: 10000,
        pointsPerKm: 10,
        swimTypeAllowed: "ANY",
        submissionDays: 7,
        lateUploadDays: 3,
        firstSwimBonusPoints: 20,
        longSwimTier1M: 1000,
        longSwimTier1Points: 10,
        longSwimTier2M: 3000,
        longSwimTier2Points: 25,
        multiplierTwoDaysPct: 110,
        multiplierThreeDaysPct: 120,
        streakStepPct: 5,
        multiplierMaxPct: 140,
        startChoiceDeadlineAt: null,
        minSwimDistanceM: 500,
        extraSlowestPaceSecPer100m: 240,
      },
      rulesText: "Be fair",
      rulesUrl: "https://example.com/rules",
      eligibilityNotes: "Company staff",
      contactChannel: "zalo group",
      bannerImageId: "banner1",
      logoImageId: "logo1",
      canJoin: true,
      joinHref: `/tournaments/${tournament.id}/join`,
    });
    const json = JSON.stringify(details);
    expect(json).not.toContain("@example.com");
    expect(json).not.toContain("token-PUBLISHED");
    expect(Object.keys(details!.organizer).sort()).toEqual(["displayName", "id"]);
  });

  it("shows a public tournament while active and completed, but not once archived", async () => {
    const { tournament } = await tournamentWithTeams();
    await makePublic(tournament.id);
    const player = await user("player");

    expect((await getTournamentDetails(player.id, tournament.id, {}, DURING))?.status).toBe(
      "ACTIVE",
    );
    const done = await getTournamentDetails(player.id, tournament.id, {}, AFTER_END);
    expect(done).toMatchObject({ status: "COMPLETED", canJoin: false, joinHref: null });

    await db.tournament.update({ where: { id: tournament.id }, data: { status: "ARCHIVED" } });
    expect(await getTournamentDetails(player.id, tournament.id, {}, AFTER_END)).toBeNull();
  });

  it("hides an invite-only tournament from a player without a token", async () => {
    const { tournament } = await tournamentWithTeams();
    const player = await user("player");
    expect(await getTournamentDetails(player.id, tournament.id, {}, BEFORE_START)).toBeNull();
    await db.tournament.update({
      where: { id: tournament.id },
      data: { visibility: "INVITE_ONLY" },
    });
    expect(await getTournamentDetails(player.id, tournament.id, {}, BEFORE_START)).toBeNull();
  });

  it("shows an invite-only tournament with its valid token and links to the invite join page", async () => {
    const { tournament, token } = await tournamentWithTeams();
    const player = await user("player");
    const details = await getTournamentDetails(player.id, tournament.id, { token }, BEFORE_START);
    expect(details).toMatchObject({ id: tournament.id, canJoin: true, joinHref: `/join/${token}` });
  });

  it("refuses a wrong token, another tournament's token and malformed tokens", async () => {
    const { tournament } = await tournamentWithTeams("PUBLISHED");
    const other = await tournamentWithTeams("COMPLETED");
    const player = await user("player");
    for (const token of ["nope", other.token, "", "x".repeat(500), 42 as unknown as string]) {
      expect(
        await getTournamentDetails(player.id, tournament.id, { token }, BEFORE_START),
      ).toBeNull();
    }
  });

  it("refuses a switched-off invite link", async () => {
    const { tournament, token } = await tournamentWithTeams();
    await db.tournament.update({ where: { id: tournament.id }, data: { inviteEnabled: false } });
    const player = await user("player");
    expect(
      await getTournamentDetails(player.id, tournament.id, { token }, BEFORE_START),
    ).toBeNull();
  });

  it("shows an invite-only tournament to an active member, who cannot join again", async () => {
    const { tournament, teams } = await tournamentWithTeams();
    const member = await addMember(teams[0].id, tournament.id, "member");
    const details = await getTournamentDetails(member.id, tournament.id, {}, BEFORE_START);
    expect(details).toMatchObject({ id: tournament.id, canJoin: false, joinHref: null });
  });

  it("does not count a past membership as membership", async () => {
    const { tournament, teams } = await tournamentWithTeams();
    const former = await addMember(teams[0].id, tournament.id, "former", "LEFT");
    expect(await getTournamentDetails(former.id, tournament.id, {}, BEFORE_START)).toBeNull();
  });

  it("refuses joining to a player removed after the start", async () => {
    const { tournament, teams, token } = await tournamentWithTeams();
    const removed = await user("removed");
    await endedMembership(
      teams[0].id,
      tournament.id,
      removed.id,
      "REMOVED_AFTER_START",
      SEASON_START,
      DURING,
    );
    const details = await getTournamentDetails(removed.id, tournament.id, { token }, DURING);
    expect(details).toMatchObject({ canJoin: false, joinHref: null });
  });

  it("shows a draft only to its organizer", async () => {
    const { tournament, organizer, teams } = await tournamentWithTeams("DRAFT");
    await makePublic(tournament.id);
    const member = await addMember(teams[0].id, tournament.id, "member");
    const stranger = await user("stranger");

    const own = await getTournamentDetails(organizer.id, tournament.id, {}, BEFORE_START);
    expect(own).toMatchObject({ status: "DRAFT", canJoin: false, joinHref: null });
    for (const viewer of [member.id, stranger.id]) {
      expect(
        await getTournamentDetails(viewer, tournament.id, { token: "token-DRAFT" }, BEFORE_START),
      ).toBeNull();
    }
  });

  it("shows an invite-only tournament to its organizer", async () => {
    const { tournament, organizer } = await tournamentWithTeams();
    const details = await getTournamentDetails(organizer.id, tournament.id, {}, BEFORE_START);
    expect(details?.id).toBe(tournament.id);
  });

  it("returns null for unknown or malformed ids", async () => {
    const player = await user("player");
    expect(await getTournamentDetails(player.id, "missing", {}, BEFORE_START)).toBeNull();
    expect(await getTournamentDetails(player.id, "", {}, BEFORE_START)).toBeNull();
    expect(
      await getTournamentDetails(player.id, 7 as unknown as string, {}, BEFORE_START),
    ).toBeNull();
  });
});
