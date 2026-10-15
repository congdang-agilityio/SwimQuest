import { describe, expect, it } from "vitest";
import { formatDistance, formatDuration, formatPace, formatVnDateTime, swimStatus } from "./swim";

const r = (status: string) => ({ status }) as never;

describe("formatDistance", () => {
  it("uses metres below 1 km", () => {
    expect(formatDistance(0)).toBe("0 m");
    expect(formatDistance(999)).toBe("999 m");
  });
  it("uses km from 1 km, decimal comma in Vietnamese", () => {
    expect(formatDistance(1000)).toBe("1 km");
    expect(formatDistance(1250)).toBe("1,25 km");
    expect(formatDistance(1250, "en")).toBe("1.25 km");
    expect(formatDistance(12345, "en")).toBe("12.35 km");
  });
});

describe("formatDuration / formatPace", () => {
  it("formats m:ss and h:mm:ss", () => {
    expect(formatDuration(59)).toBe("0:59");
    expect(formatDuration(750)).toBe("12:30");
    expect(formatDuration(3723)).toBe("1:02:03");
  });
  it("formats pace per 100 m", () => {
    expect(formatPace(125)).toBe("2:05 /100 m");
    expect(formatPace(null)).toBe("-");
  });
});

describe("formatVnDateTime", () => {
  it("puts the time first, then dd/mm/yyyy", () => {
    expect(formatVnDateTime("2026-06-01", "14:05")).toBe("14:05 01/06/2026");
  });
});

describe("swimStatus", () => {
  const base = { isDuplicate: false, isSwim: true, results: [] };
  it("covers every case", () => {
    expect(swimStatus({ ...base, isDuplicate: true })).toBe("duplicate");
    expect(swimStatus({ ...base, isSwim: false })).toBe("notSwim");
    expect(swimStatus(base)).toBe("saved");
    expect(swimStatus({ ...base, results: [r("REJECTED"), r("VERIFIED")] })).toBe("counted");
    expect(swimStatus({ ...base, results: [r("FLAGGED")] })).toBe("flagged");
    expect(swimStatus({ ...base, results: [r("REJECTED")] })).toBe("notCounted");
  });
});
