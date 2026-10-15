import { describe, expect, it } from "vitest";
import { levelForXp, xpForLevel, xpToNextLevel } from "./levels";

const thresholds: [number, number][] = [
  [1, 0],
  [2, 50],
  [3, 150],
  [5, 500],
  [10, 2250],
  [20, 9500],
];

describe("levels", () => {
  it.each(thresholds)("xpForLevel(%i) = %i", (level, xp) => {
    expect(xpForLevel(level)).toBe(xp);
  });

  it.each(thresholds)(
    "level %i starts at %i xp and the xp just below is one level lower",
    (level, xp) => {
      expect(levelForXp(xp)).toBe(level);
      if (level > 1) expect(levelForXp(xp - 1)).toBe(level - 1);
    },
  );

  it("clamps negative and invalid totals to level 1", () => {
    expect(levelForXp(-100)).toBe(1);
    expect(levelForXp(Number.NaN)).toBe(1);
  });

  it("has no maximum level", () => {
    expect(levelForXp(xpForLevel(1000))).toBe(1000);
  });

  it("computes xp to the next level", () => {
    expect(xpToNextLevel(0)).toBe(50);
    expect(xpToNextLevel(49)).toBe(1);
    expect(xpToNextLevel(50)).toBe(100);
    expect(xpToNextLevel(-5)).toBe(50);
  });
});
