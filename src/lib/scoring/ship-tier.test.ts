import { describe, expect, it } from "vitest";
import { shipTier } from "./ship-tier";

describe("shipTier", () => {
  it.each([
    [0, 1],
    [3499, 1],
    [3500, 2],
    [6999, 2],
    [7000, 3],
    [10000, 3],
  ])("progress %i bp -> tier %i", (bp, tier) => {
    expect(shipTier(bp)).toBe(tier);
  });

  it("drops to a lower tier when progress drops", () => {
    expect(shipTier(7000)).toBe(3);
    expect(shipTier(6999)).toBe(2);
    expect(shipTier(3499)).toBe(1);
  });

  it("treats invalid or negative input as tier 1", () => {
    expect(shipTier(NaN)).toBe(1);
    expect(shipTier(-5)).toBe(1);
  });
});
