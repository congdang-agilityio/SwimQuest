import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearSessionCookie, SESSION_COOKIE, setSessionCookie } from "./cookie";

function cookieOf(res: NextResponse) {
  return res.headers.getSetCookie().find((c) => c.startsWith(`${SESSION_COOKIE}=`));
}

describe("session cookie", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is named sq_session", () => {
    expect(SESSION_COOKIE).toBe("sq_session");
  });

  it("sets the token with HttpOnly, SameSite=Lax, Path=/ and a 30-day Max-Age", () => {
    const res = setSessionCookie(NextResponse.json({}), "tok");

    const cookie = cookieOf(res)!;
    expect(cookie.startsWith("sq_session=tok;")).toBe(true);
    const attrs = cookie.toLowerCase();
    expect(attrs).toContain("httponly");
    expect(attrs).toContain("samesite=lax");
    expect(attrs).toContain("path=/");
    expect(attrs).toContain("max-age=2592000");
    expect(attrs).not.toContain("secure");
  });

  it("adds Secure in production", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(cookieOf(setSessionCookie(NextResponse.json({}), "tok"))!.toLowerCase()).toContain(
      "secure",
    );
  });

  it("clears the cookie with an empty value and Max-Age=0", () => {
    const cookie = cookieOf(clearSessionCookie(NextResponse.json({})))!;

    expect(cookie.startsWith("sq_session=;")).toBe(true);
    expect(cookie.toLowerCase()).toContain("max-age=0");
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("path=/");
  });
});
