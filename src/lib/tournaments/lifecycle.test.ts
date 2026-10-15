import { describe, expect, it } from "vitest";
import {
  effectiveStatus,
  isJoiningOpen,
  isArchivable,
  isResultsFinal,
  isRouteEditable,
  isStartLocked,
  startLockAt,
  uploadWindowEndsAt,
  type LifecycleTournament,
  type TournamentStatus,
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
  it("passes COMPLETED and ARCHIVED through unchanged", () => {
    const now = at("2026-12-01T00:00:00+07:00");
    expect(effectiveStatus({ ...base, status: "COMPLETED" }, now)).toBe("COMPLETED");
    expect(effectiveStatus({ ...base, status: "ARCHIVED" }, now)).toBe("ARCHIVED");
  });
  it("is a closed union of the FR-23 lifecycle states", () => {
    // @ts-expect-error a typo is not a valid status
    const typo: TournamentStatus = "PUBLISH";
    expect(typo).toBe("PUBLISH");
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
  it("fails closed (locked) for an invalid date", () => {
    expect(isStartLocked(base, new Date(Number.NaN))).toBe(true);
    expect(
      isStartLocked(
        { ...base, seasonStartAt: new Date(Number.NaN) },
        at("2026-10-01T00:00:00+07:00"),
      ),
    ).toBe(true);
  });
});

describe("isJoiningOpen", () => {
  it("is closed for COMPLETED and ARCHIVED", () => {
    const now = at("2026-11-15T00:00:00+07:00");
    expect(isJoiningOpen({ ...base, status: "COMPLETED" }, now)).toBe(false);
    expect(isJoiningOpen({ ...base, status: "ARCHIVED" }, now)).toBe(false);
  });
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

describe("season end, upload window and archive", () => {
  const end20: LifecycleTournament = {
    ...base,
    seasonEndAt: at("2026-11-30T20:00:00+07:00"),
    lateUploadDays: 3,
  };
  it("is ACTIVE at 19:59 and COMPLETED at 20:00 on the end day", () => {
    expect(effectiveStatus(end20, at("2026-11-30T19:59:00+07:00"))).toBe("ACTIVE");
    expect(effectiveStatus(end20, at("2026-11-30T20:00:00+07:00"))).toBe("COMPLETED");
    expect(effectiveStatus({ ...end20, status: "ACTIVE" }, at("2026-12-01T00:00:00+07:00"))).toBe(
      "COMPLETED",
    );
  });
  it("computes the upload window end and final results with M = 3", () => {
    expect(uploadWindowEndsAt(end20).getTime()).toBe(at("2026-12-03T20:00:00+07:00").getTime());
    expect(isResultsFinal(end20, at("2026-12-03T19:59:00+07:00"))).toBe(false);
    expect(isResultsFinal(end20, at("2026-12-03T20:00:00+07:00"))).toBe(true);
  });
  it("archived wins over every time state", () => {
    const archived = { ...end20, status: "ARCHIVED" as TournamentStatus };
    for (const s of ["2026-10-01", "2026-11-15", "2026-12-10"]) {
      expect(effectiveStatus(archived, at(`${s}T00:00:00+07:00`))).toBe("ARCHIVED");
    }
  });
  it("closes joining from the end and is archivable only when COMPLETED", () => {
    expect(isJoiningOpen(end20, at("2026-11-30T20:00:00+07:00"))).toBe(false);
    expect(isArchivable(end20, at("2026-11-30T19:59:00+07:00"))).toBe(false);
    expect(isArchivable(end20, at("2026-11-30T20:00:00+07:00"))).toBe(true);
    expect(isArchivable({ ...end20, status: "ARCHIVED" }, at("2026-12-10T00:00:00+07:00"))).toBe(
      false,
    );
  });
});
