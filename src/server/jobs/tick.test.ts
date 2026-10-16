import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  assignMissingStarts: vi.fn(),
  settleWeek: vi.fn(),
}));

vi.mock("@/server/db", () => ({ db: { tournament: { findMany: mocks.findMany } } }));
vi.mock("@/server/starts/auto-assign", () => ({
  assignMissingStarts: mocks.assignMissingStarts,
}));

vi.mock("@/server/scoring/settle-week", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/scoring/settle-week")>()),
  settleWeek: mocks.settleWeek,
}));

const { ensureStartsAssigned, runDueStartAssignments, runDueWeekSettlements } =
  await import("./tick");

describe("runDueStartAssignments (failure isolation)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mocks.findMany.mockReset();
    mocks.assignMissingStarts.mockReset();
  });

  it("counts a failing tournament and still runs the others", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    // First call: the tournaments due for assignment. Later calls: no start-lock work.
    mocks.findMany.mockResolvedValueOnce([{ id: "a" }, { id: "b" }, { id: "c" }]);
    mocks.findMany.mockResolvedValue([]);
    mocks.assignMissingStarts.mockImplementation(async (id: string) => {
      if (id === "b") throw new Error("boom");
      return [{ teamId: `${id}-team`, slug: "non_nuoc" }];
    });

    const now = new Date("2099-11-01T00:00:00Z");
    const result = await runDueStartAssignments(now);

    expect(result).toEqual({ tournaments: 2, assigned: 2, failed: 1 });
    expect(mocks.assignMissingStarts).toHaveBeenCalledTimes(3);
    expect(mocks.assignMissingStarts).toHaveBeenCalledWith("c", now);
    expect(log).toHaveBeenCalledOnce();
  });
});

describe("ensureStartsAssigned (page catch-up never breaks the page)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mocks.assignMissingStarts.mockReset();
  });

  it("logs a failure and returns 0 so the page still loads", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.assignMissingStarts.mockRejectedValue(new Error("lock timeout"));

    await expect(ensureStartsAssigned("t1", new Date("2099-11-01T00:00:00Z"))).resolves.toBe(0);
    expect(log).toHaveBeenCalledOnce();
  });

  it("returns the number of starts assigned", async () => {
    mocks.assignMissingStarts.mockResolvedValue([{ teamId: "x", slug: "non_nuoc" }]);

    await expect(ensureStartsAssigned("t1", new Date("2099-11-01T00:00:00Z"))).resolves.toBe(1);
  });
});

describe("runDueWeekSettlements (failure isolation)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mocks.findMany.mockReset();
    mocks.settleWeek.mockReset();
  });

  it("stops a tournament at its failing week and still settles the others", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const season = {
      seasonStartAt: new Date("2099-11-02T00:00:00+07:00"),
      seasonEndAt: new Date("2099-12-01T00:00:00+07:00"),
    };
    mocks.findMany.mockResolvedValue([
      { id: "a", ...season, weekSettlements: [] },
      { id: "b", ...season, weekSettlements: [{ weekStart: "2099-11-02" }] },
    ]);
    mocks.settleWeek.mockImplementation(async (id: string, week: string) => {
      if (id === "a" && week === "2099-11-09") throw new Error("boom");
      return true;
    });

    const now = new Date("2099-11-23T00:00:00+07:00");
    const result = await runDueWeekSettlements(now);

    expect(result).toEqual({ weeks: 3, failed: 1 });
    expect(mocks.settleWeek.mock.calls).toEqual([
      ["a", "2099-11-02", now],
      ["a", "2099-11-09", now],
      ["b", "2099-11-09", now],
      ["b", "2099-11-16", now],
    ]);
    expect(log).toHaveBeenCalledOnce();
  });
});
