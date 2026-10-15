import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  assignMissingStarts: vi.fn(),
}));

vi.mock("@/server/db", () => ({ db: { tournament: { findMany: mocks.findMany } } }));
vi.mock("@/server/starts/auto-assign", () => ({
  assignMissingStarts: mocks.assignMissingStarts,
}));

const { ensureStartsAssigned, runDueStartAssignments } = await import("./tick");

describe("runDueStartAssignments (failure isolation)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mocks.findMany.mockReset();
    mocks.assignMissingStarts.mockReset();
  });

  it("counts a failing tournament and still runs the others", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }, { id: "c" }]);
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
