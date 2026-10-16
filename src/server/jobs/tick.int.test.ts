import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { assignMissingStarts } from "@/server/starts/auto-assign";
import { ensureStartsAssigned, runDueStartAssignments } from "./tick";

// The real assignment by default; a test can make it a no-op to leave a team without a start.
vi.mock("@/server/starts/auto-assign", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/starts/auto-assign")>();
  return { ...real, assignMissingStarts: vi.fn(real.assignMissingStarts) };
});
const assignMock = vi.mocked(assignMissingStarts);
const realAssign = (
  await vi.importActual<typeof import("@/server/starts/auto-assign")>("@/server/starts/auto-assign")
).assignMissingStarts;

async function clean() {
  await db.domainEvent.deleteMany();
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
  opts: {
    status?: Status;
    seasonStartAt?: Date;
    seasonEndAt?: Date;
    startChoiceDeadlineAt?: Date;
  } = {},
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
      seasonEndAt: opts.seasonEndAt ?? new Date("2099-12-01T00:00:00+07:00"),
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
  afterEach(() => {
    vi.restoreAllMocks();
    assignMock.mockReset();
    assignMock.mockImplementation(realAssign);
  });
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

  it("emits TEAM_START_LOCKED once per team, however many ticks run", async () => {
    const t = await setupTournament();
    const a = await addTeam(t.id, "non_nuoc");
    const b = await addTeam(t.id);
    const other = await setupTournament({ status: "DRAFT" });
    await addTeam(other.id, "hon_sup");

    await runDueStartAssignments(SEASON_START);
    await runDueStartAssignments(new Date(SEASON_START.getTime() + 60_000));
    await runDueStartAssignments(new Date(SEASON_START.getTime() + 120_000));

    const events = await db.domainEvent.findMany({ where: { type: "TEAM_START_LOCKED" } });
    expect(events).toHaveLength(2);
    expect(events.map((e) => (e.payload as { teamId: string }).teamId).sort()).toEqual(
      [a.id, b.id].sort(),
    );
    expect(events[0].tournamentId).toBe(t.id);
    const row = await db.tournament.findUniqueOrThrow({ where: { id: t.id } });
    expect(row.startLockProcessedAt).not.toBeNull();
    expect(
      (await db.tournament.findUniqueOrThrow({ where: { id: other.id } })).startLockProcessedAt,
    ).toBeNull();
  });

  it("emits no start-lock event before the lock time", async () => {
    const t = await setupTournament();
    await addTeam(t.id, "non_nuoc");
    await runDueStartAssignments(BEFORE);
    expect(await db.domainEvent.count({ where: { type: "TEAM_START_LOCKED" } })).toBe(0);
  });

  it("emits no start-lock event for a completed tournament", async () => {
    const done = await setupTournament({ seasonEndAt: new Date(SEASON_START.getTime() + 1000) });
    await addTeam(done.id, "non_nuoc");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await runDueStartAssignments(new Date(SEASON_START.getTime() + 2000));

    expect(await db.domainEvent.count({ where: { type: "TEAM_START_LOCKED" } })).toBe(0);
    expect(log).not.toHaveBeenCalled();
  });

  it("rolls the claim back when a team has no start, and emits on a later tick", async () => {
    const t = await setupTournament();
    const open = await addTeam(t.id);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    assignMock.mockResolvedValueOnce([]);

    await runDueStartAssignments(SEASON_START);

    expect(await db.domainEvent.count({ where: { type: "TEAM_START_LOCKED" } })).toBe(0);
    expect(
      (await db.tournament.findUniqueOrThrow({ where: { id: t.id } })).startLockProcessedAt,
    ).toBeNull();
    expect(log).toHaveBeenCalledOnce();

    await runDueStartAssignments(new Date(SEASON_START.getTime() + 60_000));
    await runDueStartAssignments(new Date(SEASON_START.getTime() + 120_000));

    const events = await db.domainEvent.findMany({ where: { type: "TEAM_START_LOCKED" } });
    expect(events).toHaveLength(1);
    expect((events[0].payload as { teamId: string }).teamId).toBe(open.id);
  });

  it("still emits for the other tournaments when one fails", async () => {
    const created = [await setupTournament(), await setupTournament()];
    const [first, second] = created.sort((x, y) => (x.id < y.id ? -1 : 1));
    await addTeam(first.id);
    const ok = await addTeam(second.id, "non_nuoc");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    // The first tournament in processing order keeps a team without a start and fails.
    assignMock.mockImplementation(async () => []);

    await runDueStartAssignments(SEASON_START);

    const events = await db.domainEvent.findMany({ where: { type: "TEAM_START_LOCKED" } });
    expect(events.map((e) => e.tournamentId)).toEqual([second.id]);
    expect((events[0].payload as { teamId: string }).teamId).toBe(ok.id);
    expect(log).toHaveBeenCalledOnce();
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
