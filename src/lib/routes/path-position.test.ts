import { describe, expect, it } from "vitest";
import { pointAlongPath } from "./path-position";

const path = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
];

describe("pointAlongPath", () => {
  it("is the first point at 0", () => {
    expect(pointAlongPath(path, 0)).toEqual({ x: 0, y: 0 });
  });
  it("is halfway by length at 0.5", () => {
    expect(pointAlongPath(path, 0.5)).toEqual({ x: 10, y: 0 });
    expect(pointAlongPath(path, 0.75)).toEqual({ x: 10, y: 5 });
  });
  it("is the last point at 1 and beyond", () => {
    expect(pointAlongPath(path, 1)).toEqual({ x: 10, y: 10 });
    expect(pointAlongPath(path, 1.7)).toEqual({ x: 10, y: 10 });
  });
  it("clamps a negative fraction to the start", () => {
    expect(pointAlongPath(path, -1)).toEqual({ x: 0, y: 0 });
  });
  it("measures length in map-box units with the aspect ratio", () => {
    // x counts 2x: segments weigh 20 and 10, so a third of 30 is at x = 5.
    const p = pointAlongPath(path, 1 / 3, 2);
    expect(p.x).toBeCloseTo(5);
    expect(p.y).toBeCloseTo(0);
  });
  it("handles a single point and rejects an empty path", () => {
    expect(pointAlongPath([{ x: 3, y: 4 }], 0.5)).toEqual({ x: 3, y: 4 });
    expect(() => pointAlongPath([], 0.5)).toThrow(RangeError);
  });
});
