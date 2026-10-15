import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  addMember,
  BEFORE_START,
  cleanJoinRows,
  SEASON_END,
  tournamentWithTeams,
  user,
} from "./__tests__/fixtures";
import { joinTeam, type JoinResult } from "./join-team";

const joinError = (code: string, status = 409) => expect.objectContaining({ code, status });
const activeMembers = (teamId: string) =>
  db.teamMember.count({ where: { teamId, status: "ACTIVE" } });

describe("joinTeam", () => {
  beforeEach(cleanJoinRows);
  afterAll(async () => {
    await cleanJoinRows();
    await db.$disconnect();
  });

  it("adds the player to the chosen team at once, without approval", async () => {
    const { tournament, teams, token } = await tournamentWithTeams();
    const player = await user("player");

    const result = await joinTeam(player.id, token, teams[0].id, BEFORE_START);

    expect(result).toEqual({
      tournamentId: tournament.id,
      team: { id: teams[0].id, name: "Team 0", emblemKey: "dolphin" },
    });
    const member = await db.teamMember.findFirstOrThrow({ where: { userId: player.id } });
    expect(member).toMatchObject({ teamId: teams[0].id, tournamentId: tournament.id });
    expect(member.status).toBe("ACTIVE");
  });

  it("refuses a full team and adds nothing", async () => {
    const { tournament, teams, token } = await tournamentWithTeams("PUBLISHED", [2, 1]);
    await addMember(teams[1].id, tournament.id, "m1");
    await addMember(teams[1].id, tournament.id, "left", "LEFT");
    const player = await user("player");

    await expect(joinTeam(player.id, token, teams[1].id, BEFORE_START)).rejects.toEqual(
      joinError("TEAM_FULL"),
    );
    expect(await activeMembers(teams[1].id)).toBe(1);
  });

  it("returns the current team on a second join and adds nothing", async () => {
    const { teams, token } = await tournamentWithTeams();
    const player = await user("player");
    await joinTeam(player.id, token, teams[0].id, BEFORE_START);

    const again = joinTeam(player.id, token, teams[1].id, BEFORE_START);

    await expect(again).rejects.toEqual(joinError("ALREADY_MEMBER"));
    await expect(again).rejects.toMatchObject({ team: { id: teams[0].id, name: "Team 0" } });
    expect(await db.teamMember.count({ where: { userId: player.id } })).toBe(1);
  });

  it.each(["DRAFT", "COMPLETED"] as const)("refuses a %s tournament as closed", async (s) => {
    const { teams, token } = await tournamentWithTeams(s);
    const player = await user("player");
    await expect(joinTeam(player.id, token, teams[0].id, BEFORE_START)).rejects.toEqual(
      joinError("JOIN_CLOSED"),
    );
    expect(await db.teamMember.count()).toBe(0);
  });

  it("refuses joining from the season end", async () => {
    const { teams, token } = await tournamentWithTeams();
    const player = await user("player");
    await expect(joinTeam(player.id, token, teams[0].id, SEASON_END)).rejects.toEqual(
      joinError("JOIN_CLOSED"),
    );
  });

  it("returns NOT_FOUND for an unknown token or a team of another tournament", async () => {
    const { teams, token } = await tournamentWithTeams();
    const other = await tournamentWithTeams("COMPLETED");
    const player = await user("player");
    const cases: [unknown, unknown][] = [
      ["unknown", teams[0].id],
      [null, teams[0].id],
      [token, other.teams[0].id],
      [token, "missing"],
      [token, 42],
    ];
    for (const [t, teamId] of cases) {
      await expect(joinTeam(player.id, t, teamId, BEFORE_START)).rejects.toEqual(
        joinError("NOT_FOUND", 404),
      );
    }
    expect(await db.teamMember.count()).toBe(0);
  });

  it("lets exactly one of concurrent joins take the last place", async () => {
    const { teams, token } = await tournamentWithTeams("PUBLISHED", [2, 1]);
    const players: { id: string }[] = [];
    for (let i = 0; i < 6; i++) players.push(await user(`p${i}`));

    // Hold the team row while every join starts, so they all reach the database together.
    let joins: Promise<PromiseSettledResult<unknown>[]> = Promise.resolve([]);
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Team" WHERE "id" = ${teams[1].id} FOR UPDATE`;
      joins = Promise.allSettled(
        players.map((p) => joinTeam(p.id, token, teams[1].id, BEFORE_START)),
      );
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    const results = await joins;

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((r) => r.status === "rejected");
    expect(rejected.map((r) => r.reason)).toEqual(Array(5).fill(joinError("TEAM_FULL")));
    expect(await activeMembers(teams[1].id)).toBe(1);
  });

  it("adds a player only once when they join two teams at the same time", async () => {
    const { teams, token } = await tournamentWithTeams();
    const player = await user("player");

    // Holding the user row stops both inserts at their foreign key check, after both have seen
    // no membership, so only the unique index can refuse the second one.
    let joins: Promise<PromiseSettledResult<JoinResult>[]> = Promise.resolve([]);
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${player.id} FOR UPDATE`;
      joins = Promise.allSettled(
        teams.map((team) => joinTeam(player.id, token, team.id, BEFORE_START)),
      );
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    const results = await joins;

    const joined = results.find((r) => r.status === "fulfilled");
    const rejected = results.find((r) => r.status === "rejected");
    expect(rejected?.reason).toEqual(joinError("ALREADY_MEMBER"));
    expect(rejected?.reason.team.id).toBe(joined?.value.team.id);
    expect(await db.teamMember.count({ where: { userId: player.id } })).toBe(1);
  });
});
