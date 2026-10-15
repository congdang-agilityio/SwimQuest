import { afterEach, describe, expect, it, vi } from "vitest";
import { pageOrigin, publicOrigin, publicOriginFrom, requestHostOrigin } from "./request";

const spoofed = {
  "x-forwarded-host": "evil.example",
  "x-forwarded-proto": "http",
  host: "evil.example",
};

function request(headers: Record<string, string> = {}) {
  return new Request("http://localhost:4102/api/x", { headers });
}

describe("publicOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the configured APP_URL origin without path or trailing slash", () => {
    vi.stubEnv("APP_URL", "https://swim.example.com/some/path/");
    expect(publicOrigin(request())).toBe("https://swim.example.com");
  });

  it("ignores forwarded host, protocol and host headers when APP_URL is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://swim.example.com");
    expect(publicOrigin(request(spoofed))).toBe("https://swim.example.com");
  });

  it.each(["not a url", "ftp://swim.example.com", "javascript:alert(1)"])(
    "throws for an invalid APP_URL %j",
    (value) => {
      vi.stubEnv("APP_URL", value);
      expect(() => publicOrigin(request())).toThrow(/APP_URL/);
    },
  );

  it.each(["development", "test"])(
    "falls back to the request URL origin in %s, ignoring forwarded headers",
    (env) => {
      vi.stubEnv("NODE_ENV", env);
      vi.stubEnv("APP_URL", "");
      expect(publicOrigin(request(spoofed))).toBe("http://localhost:4102");
    },
  );

  it("throws in production when APP_URL is not set, never using the request headers", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "");
    expect(() => publicOrigin(request(spoofed))).toThrow(/APP_URL/);
  });
});

describe("publicOriginFrom", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers the configured APP_URL origin over the fallback", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://swim.example.com/x");
    expect(publicOriginFrom("http://evil.example")).toBe("https://swim.example.com");
  });

  it("uses the fallback origin in development and test without APP_URL", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_URL", "");
    expect(publicOriginFrom("http://localhost:4101")).toBe("http://localhost:4101");
  });

  it.each(["javascript:alert(1)", "not a url"])("throws for an invalid APP_URL %j", (value) => {
    vi.stubEnv("APP_URL", value);
    expect(() => publicOriginFrom("http://localhost:4101")).toThrow(/APP_URL/);
  });

  it("throws in production without APP_URL instead of using the fallback", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "");
    expect(() => publicOriginFrom("http://evil.example")).toThrow(/APP_URL/);
  });
});

describe("requestHostOrigin", () => {
  it("uses https when x-forwarded-proto is https (the #573 reproduction)", () => {
    const h = new Headers({ host: "localhost:4100", "x-forwarded-proto": "https" });
    expect(requestHostOrigin(h)).toBe("https://localhost:4100");
  });

  it.each([undefined, "http", "wss", "", "httpss"])(
    "uses http when x-forwarded-proto is %j",
    (proto) => {
      const h = new Headers({ host: "localhost:4100" });
      if (proto !== undefined) h.set("x-forwarded-proto", proto);
      expect(requestHostOrigin(h)).toBe("http://localhost:4100");
    },
  );

  it("reads only the first, trimmed, case-insensitive x-forwarded-proto value", () => {
    expect(
      requestHostOrigin(new Headers({ host: "a.test", "x-forwarded-proto": " HTTPS , http" })),
    ).toBe("https://a.test");
    expect(
      requestHostOrigin(new Headers({ host: "a.test", "x-forwarded-proto": "http, https" })),
    ).toBe("http://a.test");
  });

  it("never reads x-forwarded-host", () => {
    const h = new Headers({ host: "localhost:4100", "x-forwarded-host": "evil.example" });
    expect(requestHostOrigin(h)).toBe("http://localhost:4100");
  });

  it("falls back to localhost without a Host header", () => {
    expect(requestHostOrigin(new Headers())).toBe("http://localhost");
    expect(requestHostOrigin(new Headers({ "x-forwarded-proto": "https" }))).toBe(
      "https://localhost",
    );
  });

  it("falls back to localhost for a Host header that is not a plain host", () => {
    expect(requestHostOrigin(new Headers({ host: "a.test/evil?x" }))).toBe("http://localhost");
  });
});

describe("pageOrigin", () => {
  const headers = () =>
    new Headers({
      host: "localhost:4100",
      "x-forwarded-proto": "https",
      "x-forwarded-host": "evil.example",
    });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("prefers a valid APP_URL over the request headers", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://swim.example.com/x");
    expect(pageOrigin(headers())).toBe("https://swim.example.com");
  });

  it.each(["development", "test"])("uses the request host fallback in %s", (env) => {
    vi.stubEnv("NODE_ENV", env);
    vi.stubEnv("APP_URL", "");
    expect(pageOrigin(headers())).toBe("https://localhost:4100");
  });

  it("returns null and logs in production without APP_URL", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(pageOrigin(headers())).toBeNull();
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/APP_URL is not set/));
  });

  it.each(["not a url", "ftp://swim.example.com", "javascript:alert(1)"])(
    "returns null and logs in production with an invalid APP_URL %j",
    (value) => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("APP_URL", value);
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(pageOrigin(headers())).toBeNull();
      expect(error).toHaveBeenCalledWith(expect.stringMatching(/APP_URL must be/));
    },
  );
});
