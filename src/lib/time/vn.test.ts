import { describe, expect, it } from "vitest";
import { defaultSeasonTimes, formatVnDateTime, utcToVnParts, vnDayKey, vnLocalToUtc } from "./vn";

describe("vnLocalToUtc", () => {
  it("converts Vietnam local to UTC", () => {
    expect(vnLocalToUtc("2026-11-01", "06:00").toISOString()).toBe("2026-10-31T23:00:00.000Z");
  });
  it("handles year boundary", () => {
    expect(vnLocalToUtc("2027-01-01", "00:00").toISOString()).toBe("2026-12-31T17:00:00.000Z");
  });
  it("handles leap day", () => {
    expect(vnLocalToUtc("2028-03-01", "06:30").toISOString()).toBe("2028-02-29T23:30:00.000Z");
  });
  it.each([
    ["2026-13-01", "06:00"],
    ["2026-02-30", "06:00"],
    ["2026-11-1", "06:00"],
    ["abc", "06:00"],
    ["2026-11-01", "24:00"],
    ["2026-11-01", "06:60"],
    ["2026-11-01", "6:00"],
    ["2026-11-01", ""],
  ])("rejects invalid input %s %s", (d, t) => {
    expect(() => vnLocalToUtc(d, t)).toThrow();
  });
});

describe("utcToVnParts", () => {
  it("returns Vietnam date and time", () => {
    expect(utcToVnParts(new Date("2026-10-31T23:00:00Z"))).toEqual({
      date: "2026-11-01",
      time: "06:00",
    });
  });
  it("rolls over month and year", () => {
    expect(utcToVnParts(new Date("2026-12-31T17:00:00Z"))).toEqual({
      date: "2027-01-01",
      time: "00:00",
    });
  });
  it("rejects invalid dates", () => {
    expect(() => utcToVnParts(new Date("nope"))).toThrow();
  });
});

describe("defaultSeasonTimes", () => {
  it("returns 00:00 start and 23:59 end", () => {
    const r = defaultSeasonTimes("2026-11-01", "2026-11-30");
    expect(r.start).toEqual({ date: "2026-11-01", time: "00:00" });
    expect(r.end).toEqual({ date: "2026-11-30", time: "23:59" });
  });
  it("rejects invalid dates", () => {
    expect(() => defaultSeasonTimes("2026-11-31", "2026-12-01")).toThrow();
  });
});

describe("vnDayKey", () => {
  it("uses the Vietnam calendar day", () => {
    expect(vnDayKey(new Date("2026-11-01T17:30:00Z"))).toBe("2026-11-02");
    expect(vnDayKey(new Date("2026-11-01T16:59:59Z"))).toBe("2026-11-01");
  });
  it("rolls over the year", () => {
    expect(vnDayKey(new Date("2026-12-31T17:00:00Z"))).toBe("2027-01-01");
  });
  it("rejects invalid dates", () => {
    expect(() => vnDayKey(new Date("x"))).toThrow();
  });
});

describe("formatVnDateTime", () => {
  it("formats a UTC instant as HH:mm dd/MM/yyyy in Vietnam time", () => {
    expect(formatVnDateTime(new Date("2026-10-31T23:00:00Z"))).toBe("06:00 01/11/2026");
  });
  it("rolls the day over", () => {
    expect(formatVnDateTime(new Date("2026-12-31T17:30:00Z"))).toBe("00:30 01/01/2027");
  });
  it("rejects invalid dates", () => {
    expect(() => formatVnDateTime(new Date("x"))).toThrow();
  });
});
