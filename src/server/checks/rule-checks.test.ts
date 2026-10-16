import { describe, expect, it } from "vitest";
import { evaluateRules } from "./rule-checks";

const t = (swimTypeAllowed: "ANY" | "POOL_ONLY" | "OPEN_WATER_ONLY") => ({ swimTypeAllowed });
const s = (swimType: "POOL" | "OPEN_WATER" | "UNKNOWN") => ({ swimType });

describe("evaluateRules: swim type", () => {
  it("refuses an open-water swim in a pool-only tournament, with the allowed and actual type", () => {
    expect(evaluateRules(s("OPEN_WATER"), t("POOL_ONLY"))).toEqual({
      missed: [
        {
          code: "SWIM_TYPE_NOT_ACCEPTED",
          params: { allowed: "POOL_ONLY", value: "OPEN_WATER" },
        },
      ],
    });
  });

  it("refuses a pool swim in an open-water-only tournament", () => {
    expect(evaluateRules(s("POOL"), t("OPEN_WATER_ONLY")).missed).toEqual([
      { code: "SWIM_TYPE_NOT_ACCEPTED", params: { allowed: "OPEN_WATER_ONLY", value: "POOL" } },
    ]);
  });

  it.each([
    ["POOL", "POOL_ONLY"],
    ["OPEN_WATER", "OPEN_WATER_ONLY"],
    ["POOL", "ANY"],
    ["OPEN_WATER", "ANY"],
    ["UNKNOWN", "ANY"],
    ["UNKNOWN", "POOL_ONLY"],
    ["UNKNOWN", "OPEN_WATER_ONLY"],
  ] as const)("accepts a %s swim in a %s tournament", (swimType, allowed) => {
    expect(evaluateRules(s(swimType), t(allowed))).toEqual({ missed: [] });
  });
});
