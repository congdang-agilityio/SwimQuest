import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { assignMissingStarts } from "./auto-assign";

async function clean() {
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.auditEvent.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}

const SEASON_START = new Date("2099-11-01T06:00:00+07:00");
const AT_DEADLINE = SEASON_START;
const STARTS = ["non_nuoc", "son_thuy", "pham_van_dong", "man_thai", "hon_sup", "cu_lao_cham"];

async function setupTournament(opts: { startChoiceDeadlineAt?: Date } = {}) {
  const organizer = await db.user.create({
    data: { email: "organizer@example.com", passwordHash: "h", displayName: "organizer" },
  });
  return db.tournament.create({
    data: {
      organizerId: organizer.id,
      name: "Cup",
      description: "d",
      seasonStartAt: SEASON_START,
      seasonEndAt: new Date("2099-12-01T00:00:00+07:00"),
      startChoiceDeadlineAt: opts.startChoiceDeadlineAt ?? null,
      routeId: "route01",
      routeDistanceM: 100000,
    },
  });
}

let teamNo = 0;
const addTeam = (tournamentId: string, start: string | null = null) =>
  db.team.create({
    data: {
      tournamentId,
      name: `Team ${++teamNo}`,
      emblemKey: "dolphin",
      memberLimit: 5,
      startDestination: start,
      startSetAt: start ? new Date("2099-10-01T00:00:00Z") : null,
      startSetBy: start ? "CAPTAIN" : null,
    },
  });

const team = (id: string) =>
  db.team.findUniqueOrThrow({
    where: { id },
    select: { startDestination: true, startSetAt: true, startSetBy: true },
  });

describe("assignMissingStarts", () => {
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("does nothing before the start-choice deadline", async () => {
    const t = await setupTournament();
    const open = await addTeam(t.id);
    const result = await assignMissingStarts(t.id, new Date(SEASON_START.getTime() - 1000));
    expect(result).toEqual([]);
    expect((await team(open.id)).startDestination).toBeNull();
    expect(await db.auditEvent.count()).toBe(0);
  });

  it("uses the start-choice deadline when it is earlier than the season start", async () => {
    const deadline = new Date("2099-10-30T12:00:00+07:00");
    const t = await setupTournament({ startChoiceDeadlineAt: deadline });
    const open = await addTeam(t.id);
    await assignMissingStarts(t.id, new Date(deadline.getTime() - 1));
    expect((await team(open.id)).startDestination).toBeNull();
    const result = await assignMissingStarts(t.id, deadline);
    expect(result).toHaveLength(1);
    expect((await team(open.id)).startDestination).not.toBeNull();
  });

  it("gives a team one of the least-chosen starts (counts 3/2/1/1/1/1), never Ly Son", async () => {
    const t = await setupTournament();
    for (let i = 0; i < 3; i++) await addTeam(t.id, "non_nuoc");
    for (let i = 0; i < 2; i++) await addTeam(t.id, "hon_sup");
    for (const s of ["son_thuy", "pham_van_dong", "man_thai", "cu_lao_cham"])
      await addTeam(t.id, s);
    const least = ["son_thuy", "pham_van_dong", "man_thai", "cu_lao_cham"];

    const picked = new Set<string>();
    for (const r of [0, 0.3, 0.6, 0.99]) {
      const open = await addTeam(t.id);
      const [assignment] = await assignMissingStarts(t.id, AT_DEADLINE, () => r);
      expect(assignment.teamId).toBe(open.id);
      expect(least).toContain(assignment.slug);
      picked.add(assignment.slug);
      // Remove the assigned team so the next run sees the same counts again.
      await db.team.delete({ where: { id: open.id } });
    }
    // The random value picks uniformly among the four least-chosen starts.
    expect([...picked].sort()).toEqual([...least].sort());
  });

  it("assigns several teams one at a time, so equal counts give different starts", async () => {
    const t = await setupTournament();
    for (const s of STARTS) await addTeam(t.id, s);
    const open = [await addTeam(t.id), await addTeam(t.id), await addTeam(t.id)];
    // Always pick the first of the least-chosen starts: counting each assignment for the next
    // is what makes them differ.
    const result = await assignMissingStarts(t.id, AT_DEADLINE, () => 0);
    expect(result).toHaveLength(3);
    expect(new Set(result.map((r) => r.teamId))).toEqual(new Set(open.map((o) => o.id)));
    expect(new Set(result.map((r) => r.slug)).size).toBe(3);
    for (const o of open) {
      const row = await team(o.id);
      expect(STARTS).toContain(row.startDestination);
      expect(row).toMatchObject({ startSetAt: AT_DEADLINE, startSetBy: "AUTOMATIC" });
    }
  });

  it("assigns the teams in random order", async () => {
    const t = await setupTournament();
    const open = [await addTeam(t.id), await addTeam(t.id), await addTeam(t.id)];
    const orders = new Set<string>();
    for (const r of [0, 0.99]) {
      await db.team.updateMany({
        where: { id: { in: open.map((o) => o.id) } },
        data: { startDestination: null, startSetAt: null, startSetBy: null },
      });
      const result = await assignMissingStarts(t.id, AT_DEADLINE, () => r);
      orders.add(result.map((a) => a.teamId).join(","));
    }
    expect(orders.size).toBe(2);
  });

  it("never changes a team that already has a start", async () => {
    const t = await setupTournament();
    const chosen = await addTeam(t.id, "man_thai");
    const before = await team(chosen.id);
    await addTeam(t.id);
    await assignMissingStarts(t.id, AT_DEADLINE);
    expect(await team(chosen.id)).toEqual(before);
  });

  it("assigns nothing new on a second run", async () => {
    const t = await setupTournament();
    await addTeam(t.id);
    await addTeam(t.id);
    expect(await assignMissingStarts(t.id, AT_DEADLINE)).toHaveLength(2);
    expect(await assignMissingStarts(t.id, new Date(AT_DEADLINE.getTime() + 60000))).toEqual([]);
    expect(await db.auditEvent.count()).toBe(2);
  });

  it("assigns each team once when runs are concurrent", async () => {
    const t = await setupTournament();
    const open = [await addTeam(t.id), await addTeam(t.id), await addTeam(t.id)];
    const results = await Promise.all([
      assignMissingStarts(t.id, AT_DEADLINE),
      assignMissingStarts(t.id, AT_DEADLINE),
      assignMissingStarts(t.id, AT_DEADLINE),
    ]);
    expect(results.flat()).toHaveLength(3);
    expect(await db.auditEvent.count()).toBe(3);
    const slugs = await Promise.all(open.map(async (o) => (await team(o.id)).startDestination));
    expect(new Set(slugs).size).toBe(3);
  });

  it("only touches the given tournament", async () => {
    const t = await setupTournament();
    const other = await db.tournament.create({
      data: {
        organizerId: t.organizerId,
        name: "Other",
        description: "d",
        seasonStartAt: SEASON_START,
        seasonEndAt: new Date("2099-12-01T00:00:00+07:00"),
        routeId: "route01",
        routeDistanceM: 100000,
      },
    });
    const elsewhere = await addTeam(other.id);
    await addTeam(t.id);
    await assignMissingStarts(t.id, AT_DEADLINE);
    expect((await team(elsewhere.id)).startDestination).toBeNull();
  });

  it("audits each assignment as a system action", async () => {
    const t = await setupTournament();
    const open = await addTeam(t.id);
    const [assignment] = await assignMissingStarts(t.id, AT_DEADLINE);
    const events = await db.auditEvent.findMany();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      actorType: "SYSTEM",
      actorUserId: null,
      action: "TEAM_START_AUTO_ASSIGNED",
      entityType: "Team",
      entityId: open.id,
      tournamentId: t.id,
      before: { teamId: open.id, tournamentId: t.id, startDestination: null },
      after: {
        teamId: open.id,
        tournamentId: t.id,
        startDestination: assignment.slug,
        startSetAt: AT_DEADLINE.toISOString(),
        startSetBy: "AUTOMATIC",
      },
    });
  });

  it("does nothing for an unknown tournament or invalid input", async () => {
    expect(await assignMissingStarts("missing", AT_DEADLINE)).toEqual([]);
    await expect(assignMissingStarts("", AT_DEADLINE)).rejects.toThrow(TypeError);
    await expect(assignMissingStarts("x", new Date("invalid"))).rejects.toThrow(TypeError);
  });
});
