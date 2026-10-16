import { describe, expect, it } from "vitest";
import { isPublicPath, safeNextPath } from "./public-paths";

describe("safeNextPath", () => {
  it.each(["/", "/home", "/tournaments/1?tab=team", "/a/b#c", "/search?q=%2F%2Fx", "/%0A"])(
    "keeps the same-site path %j",
    (path) => {
      expect(safeNextPath(path)).toBe(path);
    },
  );

  it.each([
    "//evil.com",
    "///evil.com",
    "/\\evil.com",
    "/\\/evil.com",
    "https://evil.com",
    "http://evil.com/home",
    "javascript:alert(1)",
    "evil.com",
    "home",
    "",
    "/\t/evil.com",
    "/\n/evil.com",
    "\\\\evil.com",
  ])("rejects %j", (path) => {
    expect(safeNextPath(path)).toBe("/");
  });

  it.each([undefined, null, 42, ["/home"], { path: "/home" }])(
    "rejects the non-string %j",
    (value) => {
      expect(safeNextPath(value)).toBe("/");
    },
  );

  it("uses the given fallback", () => {
    expect(safeNextPath("//evil.com", "/home")).toBe("/home");
  });

  it("rejects overly long paths", () => {
    expect(safeNextPath(`/${"a".repeat(2048)}`)).toBe("/");
  });
});

describe("isPublicPath", () => {
  it.each([
    "/login",
    "/login/",
    "/signup",
    "/welcome",
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/signup",
    "/api/health",
    "/api/jobs/tick",
    "/api/images/ckabc123",
    "/manifest.webmanifest",
    "/favicon.ico",
    "/robots.txt",
    "/icons/icon-192.png",
    "/art/route01/map.svg",
    "/_next/static/chunks/main.js",
    "/_next/image",
  ])("treats %j as public", (path) => {
    expect(isPublicPath(path)).toBe(true);
  });

  it.each([
    "/",
    "/home",
    "/tournaments",
    "/tournaments/1",
    "/loginx",
    "/signups",
    "/welcomes",
    "/api/me",
    "/api/authx",
    "/api/auth",
    "/api/healthz",
    "/api/jobs",
    "/api/jobs/other",
    "/api/jobs/tickx",
    "/api/swims/upload",
    "/api/images",
    "/profile/photo.png",
    "/icons",
    "/artwork/a.svg",
  ])("treats %j as protected", (path) => {
    expect(isPublicPath(path)).toBe(false);
  });
});
