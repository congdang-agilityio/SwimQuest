import { describe, expect, it } from "vitest";
import { teamCollectibles } from "./team";

describe("teamCollectibles", () => {
  it.each([
    [0, [], []],
    [1999, [], []],
    [2000, [20], []],
    [4999, [20, 40], []],
    [5000, [20, 40], ["HALFWAY"]],
    [8000, [20, 40, 60, 80], ["HALFWAY"]],
    [9999, [20, 40, 60, 80], ["HALFWAY"]],
    [10000, [20, 40, 60, 80], ["HALFWAY"]],
  ])("progress %i unfinished", (progressBp, fragments, chests) => {
    expect(teamCollectibles({ progressBp, finished: false })).toEqual({
      mapFragments: fragments,
      treasureChests: chests,
      voyageMapComplete: false,
    });
  });

  it.each([
    [0, [], ["LY_SON"]],
    [1999, [], ["LY_SON"]],
    [4999, [20, 40], ["LY_SON"]],
    [5000, [20, 40], ["HALFWAY", "LY_SON"]],
    [10000, [20, 40, 60, 80], ["HALFWAY", "LY_SON"]],
  ])("progress %i finished", (progressBp, fragments, chests) => {
    const result = teamCollectibles({ progressBp, finished: true });
    expect(result.mapFragments).toEqual(fragments);
    expect(result.treasureChests).toEqual(chests);
    expect(result.voyageMapComplete).toBe(progressBp >= 8000);
  });

  it("completes the voyage map only with four fragments and finished", () => {
    expect(teamCollectibles({ progressBp: 8000, finished: true }).voyageMapComplete).toBe(true);
    expect(teamCollectibles({ progressBp: 10000, finished: false }).voyageMapComplete).toBe(false);
    expect(teamCollectibles({ progressBp: 7999, finished: true }).voyageMapComplete).toBe(false);
  });

  it("removes collectibles when progress drops", () => {
    const high = teamCollectibles({ progressBp: 6000, finished: false });
    expect(high.mapFragments).toContain(40);
    expect(high.treasureChests).toContain("HALFWAY");
    const low = teamCollectibles({ progressBp: 3900, finished: false });
    expect(low.mapFragments).toEqual([20]);
    expect(low.treasureChests).toEqual([]);
  });

  it("exposes no points, progress or spend fields", () => {
    const keys = Object.keys(teamCollectibles({ progressBp: 10000, finished: true }));
    expect(keys.sort()).toEqual(["mapFragments", "treasureChests", "voyageMapComplete"]);
  });
});
