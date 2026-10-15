import { afterEach, describe, expect, it, vi } from "vitest";
import { publicOrigin, publicOriginFrom } from "./request";

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
