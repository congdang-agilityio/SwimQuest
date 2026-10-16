import { describe, expect, it } from "vitest";
import { deadlinesSettingsSchema } from "./deadlines";

const START = new Date("2026-11-01T06:00:00+07:00");
const errorsOf = (input: unknown, start: Date | undefined = START) => {
  const parsed = deadlinesSettingsSchema(start).safeParse(input);
  if (parsed.success) return null;
  return Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]));
};

describe("deadlinesSettingsSchema", () => {
  it("defaults to 7 and 3 days and no deadline (null)", () => {
    expect(deadlinesSettingsSchema(START).parse({})).toEqual({
      submissionDays: 7,
      lateUploadDays: 3,
      startChoiceDeadlineAt: null,
    });
    expect(
      deadlinesSettingsSchema(START).parse({
        submissionDays: "",
        startChoiceDeadlineDate: "",
        startChoiceDeadlineTime: "",
      }),
    ).toMatchObject({ submissionDays: 7, startChoiceDeadlineAt: null });
  });

  it("accepts 0 and 60 days, as numbers or text", () => {
    expect(
      deadlinesSettingsSchema(START).parse({ submissionDays: 0, lateUploadDays: "60" }),
    ).toMatchObject({ submissionDays: 0, lateUploadDays: 60 });
  });

  it("refuses 61, negative, fractional and non-numeric days", () => {
    expect(errorsOf({ submissionDays: 61 })).toEqual({ submissionDays: "DAYS_INVALID" });
    expect(errorsOf({ lateUploadDays: -1 })).toEqual({ lateUploadDays: "DAYS_INVALID" });
    expect(errorsOf({ lateUploadDays: "1.5" })).toEqual({ lateUploadDays: "DAYS_INVALID" });
    expect(errorsOf({ submissionDays: "abc" })).toEqual({ submissionDays: "DAYS_INVALID" });
  });

  it("accepts a deadline equal to the season start, in Vietnam time", () => {
    const out = deadlinesSettingsSchema(START).parse({
      startChoiceDeadlineDate: "2026-11-01",
      startChoiceDeadlineTime: "06:00",
    });
    expect(out.startChoiceDeadlineAt).toEqual(START);
  });

  it("refuses a deadline one minute after the season start", () => {
    expect(
      errorsOf({ startChoiceDeadlineDate: "2026-11-01", startChoiceDeadlineTime: "06:01" }),
    ).toEqual({ startChoiceDeadlineDate: "DEADLINE_AFTER_SEASON_START" });
  });

  it("refuses a half-filled or malformed deadline", () => {
    expect(errorsOf({ startChoiceDeadlineDate: "2026-11-01" })).toEqual({
      startChoiceDeadlineDate: "DEADLINE_INVALID",
    });
    expect(
      errorsOf({ startChoiceDeadlineDate: "2026-13-01", startChoiceDeadlineTime: "06:00" }),
    ).toEqual({ startChoiceDeadlineDate: "DEADLINE_INVALID" });
  });

  it("refuses unknown fields", () => {
    expect(errorsOf({ other: 1 })).not.toBeNull();
  });
});
