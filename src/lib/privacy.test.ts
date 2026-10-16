import { describe, expect, it } from "vitest";
import {
  PRIVACY_DEFAULTS,
  PRIVACY_FIELDS,
  canSee,
  canSeeField,
  resolvePrivacy,
  type PrivacyLevel,
  type Relation,
} from "./privacy";

const RELATIONS: Relation[] = ["SELF", "TEAMMATE", "SHARES_TOURNAMENT", "OTHER"];

describe("canSee", () => {
  const expected: Record<PrivacyLevel, Relation[]> = {
    PUBLIC: ["SELF", "TEAMMATE", "SHARES_TOURNAMENT", "OTHER"],
    MEMBERS: ["SELF", "TEAMMATE", "SHARES_TOURNAMENT"],
    PRIVATE: ["SELF"],
  };
  for (const level of Object.keys(expected) as PrivacyLevel[]) {
    for (const relation of RELATIONS) {
      const visible = expected[level].includes(relation);
      it(`${level} is ${visible ? "visible" : "hidden"} to ${relation}`, () => {
        expect(canSee(level, relation)).toBe(visible);
      });
    }
  }

  it("hides on an unknown level or relation", () => {
    expect(canSee("NOPE" as PrivacyLevel, "OTHER")).toBe(false);
    expect(canSee("PUBLIC", "NOPE" as Relation)).toBe(false);
  });
});

describe("PRIVACY_DEFAULTS", () => {
  it("makes display name and avatar public and everything else members only", () => {
    expect(PRIVACY_DEFAULTS).toEqual({
      displayName: "PUBLIC",
      avatar: "PUBLIC",
      bio: "MEMBERS",
      region: "MEMBERS",
      goals: "MEMBERS",
      stats: "MEMBERS",
      badges: "MEMBERS",
    });
  });

  it("has no email setting", () => {
    expect(PRIVACY_FIELDS).not.toContain("email");
  });
});

describe("resolvePrivacy", () => {
  it("returns the defaults for an empty or invalid stored value", () => {
    expect(resolvePrivacy({})).toEqual(PRIVACY_DEFAULTS);
    expect(resolvePrivacy(null)).toEqual(PRIVACY_DEFAULTS);
    expect(resolvePrivacy([])).toEqual(PRIVACY_DEFAULTS);
    expect(resolvePrivacy("PUBLIC")).toEqual(PRIVACY_DEFAULTS);
  });

  it("keeps stored valid levels and drops unknown fields and bad levels", () => {
    expect(
      resolvePrivacy({ bio: "PRIVATE", stats: "PUBLIC", goals: "everyone", email: "PUBLIC" }),
    ).toEqual({ ...PRIVACY_DEFAULTS, bio: "PRIVATE", stats: "PUBLIC" });
  });
});

describe("canSeeField", () => {
  const settings = { ...PRIVACY_DEFAULTS, bio: "PRIVATE" as const, stats: "PUBLIC" as const };

  it("applies the field's level", () => {
    expect(canSeeField(settings, "stats", "OTHER")).toBe(true);
    expect(canSeeField(settings, "bio", "OTHER")).toBe(false);
    expect(canSeeField(settings, "bio", "TEAMMATE")).toBe(false);
    expect(canSeeField(settings, "region", "SHARES_TOURNAMENT")).toBe(true);
    expect(canSeeField(settings, "region", "OTHER")).toBe(false);
  });

  it("shows email only to the player themself, whatever the settings", () => {
    const allPublic = { ...settings, email: "PUBLIC" } as unknown as typeof settings;
    expect(canSeeField(allPublic, "email", "SELF")).toBe(true);
    for (const relation of ["TEAMMATE", "SHARES_TOURNAMENT", "OTHER"] as Relation[]) {
      expect(canSeeField(allPublic, "email", relation)).toBe(false);
    }
  });
});
