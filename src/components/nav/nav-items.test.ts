import { describe, expect, it } from "vitest";
import { isActive, navItems } from "./nav-items";

describe("navItems", () => {
  it("lists the five destinations for a player", () => {
    expect(navItems(false).map((i) => i.key)).toEqual([
      "home",
      "tournaments",
      "team",
      "voyage",
      "profile",
    ]);
  });
  it("adds Admin, pointing at /admin, only for platform admins", () => {
    const items = navItems(true);
    expect(items.at(-1)).toEqual({ key: "admin", href: "/admin" });
    expect(items).toHaveLength(6);
  });
});

describe("isActive", () => {
  it("matches / only exactly", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/", "/profile")).toBe(false);
  });
  it("matches sub-pages but not look-alike prefixes", () => {
    expect(isActive("/tournaments", "/tournaments/abc")).toBe(true);
    expect(isActive("/team", "/teams")).toBe(false);
  });
});
