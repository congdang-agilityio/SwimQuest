import { describe, expect, it } from "vitest";
import { MAX_MEMBER_LIMIT, parseTeamInput } from "./team";

const valid = { name: "  Sharks  ", emblemKey: "dolphin", description: " Fast ", memberLimit: 5 };

describe("parseTeamInput", () => {
  it("accepts a valid team, trimming the text fields", () => {
    expect(parseTeamInput(valid)).toEqual({
      ok: true,
      data: { name: "Sharks", emblemKey: "dolphin", description: "Fast", memberLimit: 5 },
    });
  });

  it.each([[undefined], [null], [""], ["   "]])("stores a missing description %j as null", (d) => {
    const result = parseTeamInput({ ...valid, description: d });
    expect(result).toMatchObject({ ok: true, data: { description: null } });
  });

  it("accepts a one-person team (limit 1) and 40/200 character limits", () => {
    const input = { ...valid, name: "n".repeat(40), description: "d".repeat(200), memberLimit: 1 };
    expect(parseTeamInput(input).ok).toBe(true);
  });

  it.each([
    [{ name: undefined }, "name", "NAME_REQUIRED"],
    [{ name: "   " }, "name", "NAME_REQUIRED"],
    [{ name: 7 }, "name", "NAME_REQUIRED"],
    [{ name: "n".repeat(41) }, "name", "NAME_TOO_LONG"],
    [{ emblemKey: "shark" }, "emblemKey", "EMBLEM_INVALID"],
    [{ emblemKey: undefined }, "emblemKey", "EMBLEM_INVALID"],
    [{ description: "d".repeat(201) }, "description", "DESCRIPTION_TOO_LONG"],
    [{ description: 12 }, "description", "DESCRIPTION_TOO_LONG"],
    [{ memberLimit: 0 }, "memberLimit", "LIMIT_INVALID"],
    [{ memberLimit: -3 }, "memberLimit", "LIMIT_INVALID"],
    [{ memberLimit: 2.5 }, "memberLimit", "LIMIT_INVALID"],
    [{ memberLimit: "5" }, "memberLimit", "LIMIT_INVALID"],
    [{ memberLimit: undefined }, "memberLimit", "LIMIT_INVALID"],
    [{ memberLimit: MAX_MEMBER_LIMIT + 1 }, "memberLimit", "LIMIT_INVALID"],
  ])("rejects %j with %s %s", (patch, field, code) => {
    expect(parseTeamInput({ ...valid, ...patch })).toEqual({
      ok: false,
      errors: { [field]: code },
    });
  });

  it("reports every invalid field for a non-object input and ignores unknown fields", () => {
    expect(parseTeamInput(null)).toEqual({
      ok: false,
      errors: { name: "NAME_REQUIRED", emblemKey: "EMBLEM_INVALID", memberLimit: "LIMIT_INVALID" },
    });
    const result = parseTeamInput({ ...valid, captainUserId: "x", tournamentId: "y" });
    expect(result.ok && Object.keys(result.data).sort()).toEqual([
      "description",
      "emblemKey",
      "memberLimit",
      "name",
    ]);
  });
});
