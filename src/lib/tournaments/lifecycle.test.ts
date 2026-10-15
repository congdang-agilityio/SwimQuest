import { describe, expect, it } from "vitest";
import {
  effectiveStatus,
  isJoiningOpen,
  isRouteEditable,
  isStartLocked,
  startLockAt,
  type LifecycleTournament,
} from "./lifecycle";

// Season: 1 Nov 06:00 to 30 Nov 22:00 Vietnam time (UTC+7).
const seasonStartAt = new Date("2026-11-01T06:00:00+07:00");
const seasonEndAt = new Date("2026-11-30T22:00:00+07:00");
const base: LifecycleTournament = {
  status: "PUBLISHED",
  seasonStartAt,
  seasonEndAt,
  startChoiceDeadlineAt: null,
};
const at = (s: string) => new Date(s);

describe("effectiveStatus", () => {
  it("is PUBLISHED at 05:59 and ACTIVE at 06:00", () => {
    expect(effectiveStatus(base, at("2026-11-01T05:59:00+07:00"))).toBe("PUBLISHED");
    expect(effectiveStatus(base, at("2026-11-01T06:00:00+07:00"))).toBe("ACTIVE");
  });
  it("keeps DRAFT as DRAFT even after the start", () => {
    expect(effectiveStatus({ ...base, status: "DRAFT" }, at("2026-11-02T00:00:00+07:00"))).toBe(
      "DRAFT",
    );
  });
  it("keeps a stored ACTIVE tournament ACTIVE", () => {
    expect(effectiveStatus({ ...base, status: "ACTIVE" }, at("2026-10-01T00:00:00+07:00"))).toBe(
      "ACTIVE",
    );
  });
});

describe("start lock", () => {
  it("defaults to the season start", () => {
    expect(startLockAt(base)).toEqual(seasonStartAt);
    expect(isStartLocked(base, at("2026-11-01T05:59:00+07:00"))).toBe(false);
    expect(isStartLocked(base, at("2026-11-01T06:00:00+07:00"))).toBe(true);
  });
  it("uses an earlier custom deadline", () => {
    const t = { ...base, startChoiceDeadlineAt: at("2026-10-30T12:00:00+07:00") };
    expect(startLockAt(t)).toEqual(t.startChoiceDeadlineAt);
    expect(isStartLocked(t, at("2026-10-30T11:59:00+07:00"))).toBe(false);
    expect(isStartLocked(t, at("2026-10-30T12:00:00+07:00"))).toBe(true);
  });
});

describe("isJoiningOpen", () => {
  it("is open for PUBLISHED and ACTIVE before the season end", () => {
    expect(isJoiningOpen(base, at("2026-10-20T00:00:00+07:00"))).toBe(true);
    expect(isJoiningOpen(base, at("2026-11-01T06:00:00+07:00"))).toBe(true);
    expect(isJoiningOpen({ ...base, status: "ACTIVE" }, at("2026-11-15T00:00:00+07:00"))).toBe(
      true,
    );
  });
  it("closes at the season end", () => {
    expect(isJoiningOpen(base, at("2026-11-30T21:59:00+07:00"))).toBe(true);
    expect(isJoiningOpen(base, at("2026-11-30T22:00:00+07:00"))).toBe(false);
  });
  it("is closed for DRAFT", () => {
    expect(isJoiningOpen({ ...base, status: "DRAFT" }, at("2026-10-20T00:00:00+07:00"))).toBe(
      false,
    );
  });
});

describe("isRouteEditable", () => {
  it("is false once the season has started", () => {
    expect(isRouteEditable(base, at("2026-11-01T05:59:00+07:00"))).toBe(true);
    expect(isRouteEditable(base, at("2026-11-01T06:00:00+07:00"))).toBe(false);
  });
});
