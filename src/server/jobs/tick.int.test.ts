import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { ensureStartsAssigned, runDueStartAssignments } from "./tick";

async function clean() {
  await db.pointsEntry.deleteMany();
  await db.swimResult.deleteMany();
  await db.swim.deleteMany();
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.auditEvent.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}

const SEASON_START = new Date("2099-11-01T06:00:00+07:00");
const BEFORE = new Date(SEASON_START.getTime() - 1000);

type Status = "DRAFT" | "PUBLISHED" | "COMPLETED" | "ARCHIVED";

let n = 0;
async function setupTournament(
  opts: { status?: Status; seasonStartAt?: Date; startChoiceDeadlineAt?: Date } = {},
) {
  const organizer = await db.user.create({
    data: { email: `organizer${++n}@example.com`, passwordHash: "h", displayName: "organizer" },
  });
  return db.tournament.create({
    data: {
      organizerId: organizer.id,
      status: opts.status ?? "PUBLISHED",
      inviteToken: `token-tick-${n}`,
      name: "Cup",
      description: "d",
      seasonStartAt: opts.seasonStartAt ?? SEASON_START,
      seasonEndAt: new Date("2099-12-01T00:00:00+07:00"),
      startChoiceDeadlineAt: opts.startChoiceDeadlineAt ?? null,
      routeId: "route01",
      routeDistanceM: 100000,
    },
  });
}

const addTeam = (tournamentId: string, start: string | null = null) =>
  db.team.create({
    data: {
      tournamentId,
      name: `Team ${++n}`,
      emblemKey: "dolphin",
      memberLimit: 5,
      startDestination: start,
      startSetAt: start ? new Date("2099-10-01T00:00:00Z") : null,
      startSetBy: start ? "CAPTAIN" : null,
    },
  });

const startOf = async (id: string) =>
  (await db.team.findUniqueOrThrow({ where: { id }, select: { startDestination: true } }))
    .startDestination;

describe("runDueStartAssignments", () => {
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("assigns starts in every due tournament and returns the counts", async () => {
    const a = await setupTournament();
    const b = await setupTournament({
      seasonStartAt: new Date("2099-11-05T00:00:00+07:00"),
      startChoiceDeadlineAt: new Date("2099-10-30T00:00:00+07:00"),
    });
    const a1 = await addTeam(a.id);
    const a2 = await addTeam(a.id);
    const b1 = await addTeam(b.id);

    const result = await runDueStartAssignments(SEASON_START);

    expect(result).toEqual({ tournaments: 2, assigned: 3, failed: 0 });
    for (const t of [a1, a2, b1]) expect(await startOf(t.id)).not.toBeNull();
  });

  it("leaves not-yet-due tournaments untouched", async () => {
    const t = await setupTournament();
    const open = await addTeam(t.id);

    expect(await runDueStartAssignments(BEFORE)).toEqual({
      tournaments: 0,
      assigned: 0,
      failed: 0,
    });
    expect(await startOf(open.id)).toBeNull();
    expect(await db.auditEvent.count()).toBe(0);
  });

  it("skips tournaments that are not published and those where every team has a start", async () => {
    const draft = await setupTournament({ status: "DRAFT" });
    const draftTeam = await addTeam(draft.id);
    const complete = await setupTournament();
    await addTeam(complete.id, "non_nuoc");

    expect(await runDueStartAssignments(SEASON_START)).toEqual({
      tournaments: 0,
      assigned: 0,
      failed: 0,
    });
    expect(await startOf(draftTeam.id)).toBeNull();
  });

  it("is idempotent: a repeated tick assigns nothing more", async () => {
    const t = await setupTournament();
    const open = await addTeam(t.id);
    await runDueStartAssignments(SEASON_START);
    const first = await startOf(open.id);

    const again = await runDueStartAssignments(new Date(SEASON_START.getTime() + 60_000));

    expect(again).toEqual({ tournaments: 0, assigned: 0, failed: 0 });
    expect(await startOf(open.id)).toBe(first);
    expect(await db.auditEvent.count()).toBe(1);
  });

  it("rejects an invalid now", async () => {
    await expect(runDueStartAssignments(new Date("nope"))).rejects.toThrow(TypeError);
  });
});

describe("ensureStartsAssigned", () => {
  beforeEach(clean);

  it("does nothing before the deadline", async () => {
    const t = await setupTournament();
    const open = await addTeam(t.id);
    expect(await ensureStartsAssigned(t.id, BEFORE)).toBe(0);
    expect(await startOf(open.id)).toBeNull();
  });

  it("does nothing when every team has a start", async () => {
    const t = await setupTournament();
    await addTeam(t.id, "hon_sup");
    expect(await ensureStartsAssigned(t.id, SEASON_START)).toBe(0);
    expect(await db.auditEvent.count()).toBe(0);
  });

  it("assigns the missing starts once the deadline is reached", async () => {
    const t = await setupTournament();
    const open = await addTeam(t.id);
    expect(await ensureStartsAssigned(t.id, SEASON_START)).toBe(1);
    expect(await startOf(open.id)).not.toBeNull();
  });

  it("returns 0 for an unknown tournament", async () => {
    expect(await ensureStartsAssigned("missing", SEASON_START)).toBe(0);
  });
});
