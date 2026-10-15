import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { NEXT_PATH_HEADER } from "./lib/auth/public-paths";
import { config, middleware } from "./middleware";

function request(path: string, cookie?: string) {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest(new URL(path, "http://localhost:4101"), { headers });
}

describe("middleware", () => {
  it("lets public paths through without a session and without no-store", () => {
    const res = middleware(request("/login?next=%2Fhome"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.headers.get("cache-control")).toBeNull();
  });

  it("redirects a signed-out page request to /login with the path and query", () => {
    const res = middleware(request("/tournaments/1?tab=team"));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/tournaments/1?tab=team");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("does not put an unsafe path in next", () => {
    const res = middleware(request("http://localhost:4101//evil.com/x"));
    const location = new URL(res.headers.get("location")!);
    expect(location.origin).toBe("http://localhost:4101");
    expect(location.searchParams.get("next")).toBe("/");
  });

  it("answers a signed-out API request with 401 JSON", async () => {
    const res = middleware(request("/api/me"));
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe("no-store");
    await expect(res.json()).resolves.toMatchObject({ error: { code: "UNAUTHENTICATED" } });
  });

  it("treats an empty session cookie as signed out", () => {
    expect(middleware(request("/home", "sq_session=")).status).toBe(307);
  });

  it("passes a request with a session cookie on, marked no-store, with the path header", () => {
    const res = middleware(request("/home?x=1", "sq_session=abc"));
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get(`x-middleware-request-${NEXT_PATH_HEADER}`)).toBe("/home?x=1");
  });

  it("matches everything except Next's build output", () => {
    expect(config.matcher).toEqual(["/((?!_next/static|_next/image).*)"]);
  });
});
