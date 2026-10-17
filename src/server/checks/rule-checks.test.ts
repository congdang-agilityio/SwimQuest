import { describe, expect, it } from "vitest";
import { evaluateRules } from "./rule-checks";

/** Deadlines of the tournaments below: N = 7, M = 3, season ends 30 Nov 2026 20:00 VN. */
const deadlines = {
  submissionDays: 7,
  lateUploadDays: 3,
  seasonEndAt: new Date("2026-11-30T20:00:00+07:00"),
  minSwimDistanceM: null,
  extraSlowestPaceSecPer100m: null,
};
/** 1000 m in 20 minutes. */
const effort = { distanceM: 1000, durationS: 1200 };
const t = (swimTypeAllowed: "ANY" | "POOL_ONLY" | "OPEN_WATER_ONLY") => ({
  swimTypeAllowed,
  ...deadlines,
});
/** A swim started 1 Nov 2026 06:00 VN and uploaded on 2 Nov. */
const s = (swimType: "POOL" | "OPEN_WATER" | "UNKNOWN") => ({
  swimType,
  startedAt: new Date("2026-11-01T06:00:00+07:00"),
  createdAt: new Date("2026-11-02T08:00:00+07:00"),
  ...effort,
});

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

const vn = (local: string) => new Date(`${local}+07:00`);
const at = (startedAt: string, createdAt: string) => ({
  swimType: "POOL" as const,
  startedAt: vn(startedAt),
  createdAt: vn(createdAt),
  ...effort,
});
const late = (days: number, swimDate: string) => ({
  code: "UPLOADED_AFTER_DEADLINE",
  params: { days, swimDate },
});

describe("evaluateRules: submission deadline (N days after the swim date, Vietnam time)", () => {
  it("misses a swim uploaded 8 days after its date with N = 7", () => {
    expect(evaluateRules(at("2026-11-01T06:00:00", "2026-11-09T06:00:00"), t("ANY"))).toEqual({
      missed: [late(7, "2026-11-01")],
    });
  });

  it("counts an upload on the last day of the window, up to 23:59 Vietnam time", () => {
    expect(evaluateRules(at("2026-11-01T06:00:00", "2026-11-08T23:59:59"), t("ANY"))).toEqual({
      missed: [],
    });
  });

  it("misses an upload from 00:00 Vietnam time on day N + 1", () => {
    expect(evaluateRules(at("2026-11-01T06:00:00", "2026-11-09T00:00:00"), t("ANY"))).toEqual({
      missed: [late(7, "2026-11-01")],
    });
  });

  it("uses the Vietnam date of the swim start, not the UTC date", () => {
    // 1 Nov 00:30 VN is still 31 Oct in UTC; 8 Nov 23:00 VN is within 7 days of 1 Nov.
    expect(evaluateRules(at("2026-11-01T00:30:00", "2026-11-08T23:00:00"), t("ANY"))).toEqual({
      missed: [],
    });
  });

  it("uses the tournament's own N", () => {
    const swim = at("2026-11-01T06:00:00", "2026-11-03T06:00:00");
    expect(evaluateRules(swim, { ...t("ANY"), submissionDays: 1 })).toEqual({
      missed: [late(1, "2026-11-01")],
    });
    expect(evaluateRules(swim, { ...t("ANY"), submissionDays: 2 })).toEqual({ missed: [] });
  });
});

describe("evaluateRules: upload window after the season end (end time + M days)", () => {
  const closed = { code: "UPLOAD_WINDOW_CLOSED", params: { days: 3 } };

  it("counts a season swim uploaded 3 Dec 19:00 when the season ended 30 Nov 20:00, M = 3", () => {
    expect(evaluateRules(at("2026-11-30T10:00:00", "2026-12-03T19:00:00"), t("ANY"))).toEqual({
      missed: [],
    });
  });

  it("misses a season swim uploaded 3 Dec 20:01", () => {
    expect(evaluateRules(at("2026-11-30T10:00:00", "2026-12-03T20:01:00"), t("ANY"))).toEqual({
      missed: [closed],
    });
  });

  it("misses an upload exactly at the window end and counts one a second before", () => {
    const before = at("2026-11-30T10:00:00", "2026-12-03T19:59:59");
    expect(evaluateRules(before, t("ANY"))).toEqual({ missed: [] });
    const exact = at("2026-11-30T10:00:00", "2026-12-03T20:00:00");
    expect(evaluateRules(exact, t("ANY"))).toEqual({ missed: [closed] });
  });

  it("reports both deadlines and the swim type when all are missed", () => {
    const swim = {
      ...at("2026-11-20T10:00:00", "2026-12-05T10:00:00"),
      swimType: "OPEN_WATER" as const,
    };
    expect(evaluateRules(swim, t("POOL_ONLY")).missed.map((r) => r.code)).toEqual([
      "SWIM_TYPE_NOT_ACCEPTED",
      "UPLOADED_AFTER_DEADLINE",
      "UPLOAD_WINDOW_CLOSED",
    ]);
  });
});
