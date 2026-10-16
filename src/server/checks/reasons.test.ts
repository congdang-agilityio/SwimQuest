import { describe, expect, it } from "vitest";
import { readReasons } from "./reasons";

describe("readReasons", () => {
  it("reads plain string codes and reason objects with params", () => {
    expect(
      readReasons([
        "PACE_TOO_SLOW",
        { code: "SWIM_TYPE_NOT_ACCEPTED", params: { allowed: "POOL_ONLY", value: "OPEN_WATER" } },
      ]),
    ).toEqual([
      "PACE_TOO_SLOW",
      { code: "SWIM_TYPE_NOT_ACCEPTED", params: { allowed: "POOL_ONLY", value: "OPEN_WATER" } },
    ]);
  });

  it("drops malformed entries and params that are not plain strings or numbers", () => {
    expect(
      readReasons([
        7,
        null,
        { params: {} },
        { code: 3 },
        { code: "SWIM_TYPE_NOT_ACCEPTED", params: { allowed: { x: 1 }, value: "POOL", n: 2 } },
        { code: "NO_DISTANCE", params: "x" },
      ]),
    ).toEqual([
      { code: "SWIM_TYPE_NOT_ACCEPTED", params: { value: "POOL", n: 2 } },
      { code: "NO_DISTANCE" },
    ]);
  });

  it("reads anything that is not an array as no reasons", () => {
    expect(readReasons("x")).toEqual([]);
    expect(readReasons(null)).toEqual([]);
  });
});
