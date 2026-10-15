import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError, NotFoundError } from "@/server/auth/roles";
import { db } from "@/server/db";
import {
  addMember,
  BEFORE_START,
  cleanJoinRows,
  tournamentWithTeams,
  user,
} from "@/server/join/__tests__/fixtures";
import { joinTeam } from "@/server/join/join-team";
import { getJoinView } from "@/server/join/join-view";
import { replaceInviteToken, setInviteEnabled } from "./invite-link";

const TOKEN = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes, base64url without padding
const joinError = (code: string, status: number) => expect.objectContaining({ code, status });
const audits = (action: string) => db.auditEvent.findMany({ where: { action } });

describe("invite link switch and replace", () => {
  beforeEach(cleanJoinRows);
  afterAll(async () => {
    await cleanJoinRows();
    await db.$disconnect();
  });

  it("switched off: nobody can join and the view shows the link is off", async () => {
    const { organizer, tournament, teams, token } = await tournamentWithTeams();
    const player = await user("player");

    const result = await setInviteEnabled(organizer.id, tournament.id, false);

    expect(result).toEqual({ id: tournament.id, inviteEnabled: false, inviteToken: token });
    await expect(joinTeam(player.id, token, teams[0].id, BEFORE_START)).rejects.toEqual(
      joinError("LINK_OFF", 410),
    );
    expect(await db.teamMember.count()).toBe(0);
    expect(await getJoinView(player.id, token, BEFORE_START)).toMatchObject({
      linkState: "OFF",
      joiningOpen: false,
    });
  });

  it("switched on again: the same link works", async () => {
    const { organizer, tournament, teams, token } = await tournamentWithTeams();
    const player = await user("player");
    await setInviteEnabled(organizer.id, tournament.id, false);

    const result = await setInviteEnabled(organizer.id, tournament.id, true);

    expect(result).toEqual({ id: tournament.id, inviteEnabled: true, inviteToken: token });
    expect(await getJoinView(player.id, token, BEFORE_START)).toMatchObject({
      linkState: "ON",
      joiningOpen: true,
    });
    await expect(joinTeam(player.id, token, teams[0].id, BEFORE_START)).resolves.toMatchObject({
      team: { id: teams[0].id },
    });
  });

  it("replaced: a new 32-byte token works and the old one, with or without a team, is not found", async () => {
    const { organizer, tournament, teams, token } = await tournamentWithTeams();
    const player = await user("player");

    const result = await replaceInviteToken(organizer.id, tournament.id);

    expect(result.inviteToken).toMatch(TOKEN);
    expect(result.inviteToken).not.toBe(token);
    expect(result).toMatchObject({ id: tournament.id, inviteEnabled: true });
    expect(await getJoinView(player.id, token, BEFORE_START)).toBeNull();
    // A captain link is the old token with a preselected team (`?team=`).
    await expect(joinTeam(player.id, token, teams[1].id, BEFORE_START)).rejects.toEqual(
      joinError("NOT_FOUND", 404),
    );
    expect(await getJoinView(player.id, result.inviteToken, BEFORE_START)).toMatchObject({
      linkState: "ON",
    });
    await expect(
      joinTeam(player.id, result.inviteToken, teams[1].id, BEFORE_START),
    ).resolves.toMatchObject({ team: { id: teams[1].id } });
  });

  it("replacing a switched-off link gives a new link that works", async () => {
    const { organizer, tournament, teams } = await tournamentWithTeams();
    const player = await user("player");
    await setInviteEnabled(organizer.id, tournament.id, false);

    const { inviteToken, inviteEnabled } = await replaceInviteToken(organizer.id, tournament.id);

    expect(inviteEnabled).toBe(true);
    await expect(joinTeam(player.id, inviteToken, teams[0].id, BEFORE_START)).resolves.toBeTruthy();
  });

  it("leaves existing memberships unchanged", async () => {
    const { organizer, tournament, teams } = await tournamentWithTeams();
    await addMember(teams[0].id, tournament.id, "m1");
    await addMember(teams[1].id, tournament.id, "m2");
    const before = await db.teamMember.findMany({ orderBy: { id: "asc" } });

    await setInviteEnabled(organizer.id, tournament.id, false);
    await replaceInviteToken(organizer.id, tournament.id);
    await setInviteEnabled(organizer.id, tournament.id, true);

    expect(await db.teamMember.findMany({ orderBy: { id: "asc" } })).toEqual(before);
  });

  it("audits a switch and a replace without storing the token", async () => {
    const { organizer, tournament, token } = await tournamentWithTeams();

    await setInviteEnabled(organizer.id, tournament.id, false);
    const { inviteToken } = await replaceInviteToken(organizer.id, tournament.id);

    const [switched] = await audits("INVITE_LINK_SWITCHED");
    expect(switched).toMatchObject({
      actorType: "USER",
      actorUserId: organizer.id,
      entityType: "Tournament",
      entityId: tournament.id,
      tournamentId: tournament.id,
      before: { inviteEnabled: true },
      after: { inviteEnabled: false },
    });
    const replaced = await audits("INVITE_LINK_REPLACED");
    expect(replaced).toHaveLength(1);
    expect(replaced[0]).toMatchObject({
      actorUserId: organizer.id,
      entityId: tournament.id,
      tournamentId: tournament.id,
    });
    const stored = JSON.stringify(await db.auditEvent.findMany());
    expect(stored).not.toContain(token);
    expect(stored).not.toContain(inviteToken);
  });

  it("does not audit a switch that changes nothing", async () => {
    const { organizer, tournament } = await tournamentWithTeams();
    await setInviteEnabled(organizer.id, tournament.id, true);
    expect(await audits("INVITE_LINK_SWITCHED")).toHaveLength(0);
  });

  it("refuses a non-organizer and changes nothing", async () => {
    const { tournament, token } = await tournamentWithTeams();
    const outsider = await user("outsider");

    await expect(setInviteEnabled(outsider.id, tournament.id, false)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(replaceInviteToken(outsider.id, tournament.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    const stored = await db.tournament.findUniqueOrThrow({ where: { id: tournament.id } });
    expect(stored).toMatchObject({ inviteEnabled: true, inviteToken: token });
    expect(await db.auditEvent.count()).toBe(0);
  });

  it("refuses a missing tournament", async () => {
    const organizer = await user("organizer");
    await expect(setInviteEnabled(organizer.id, "missing", false)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(replaceInviteToken(organizer.id, "missing")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("refuses a tournament without an invite link with a typed 409 error", async () => {
    const { organizer, tournament } = await tournamentWithTeams();
    await db.tournament.update({ where: { id: tournament.id }, data: { inviteToken: null } });

    const noLink = joinError("NO_INVITE_LINK", 409);
    await expect(setInviteEnabled(organizer.id, tournament.id, false)).rejects.toEqual(noLink);
    await expect(replaceInviteToken(organizer.id, tournament.id)).rejects.toEqual(noLink);
    expect(await db.auditEvent.count()).toBe(0);
  });

  it("rejects a non-boolean enabled value", async () => {
    const { organizer, tournament } = await tournamentWithTeams();
    await expect(
      setInviteEnabled(organizer.id, tournament.id, "false" as unknown as boolean),
    ).rejects.toEqual(joinError("INVALID_INPUT", 400));
  });
});
