import { expect, test } from "@playwright/test";

test("a signed-out visitor opening a protected page lands on login with next", async ({ page }) => {
  await page.goto("/tournaments/1?tab=team");
  const url = new URL(page.url());
  expect(url.pathname).toBe("/login");
  expect(url.searchParams.get("next")).toBe("/tournaments/1?tab=team");
});

test("a forged session cookie is checked in the database and sent to login", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([{ name: "sq_session", value: "x".repeat(43), url: baseURL! }]);
  await page.goto("/?from=forged");
  const url = new URL(page.url());
  expect(url.pathname).toBe("/login");
  expect(url.searchParams.get("next")).toBe("/?from=forged");
});

test("protected responses are never cached", async ({ request, baseURL }) => {
  const res = await request.get("/", {
    maxRedirects: 0,
    headers: { cookie: `sq_session=${"x".repeat(43)}` },
  });
  expect(res.headers()["cache-control"]).toContain("no-store");
  expect(new URL(res.headers()["location"] ?? "", baseURL).pathname).toBe("/login");
});

test("a signed-out API request gets 401 JSON", async ({ request }) => {
  const res = await request.get("/api/me");
  expect(res.status()).toBe(401);
  expect(await res.json()).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
});

test("public paths stay reachable while signed out", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.ok()).toBe(true);
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
});

test("a signed-in player sees a protected page that is never cached", async ({ page, baseURL }) => {
  const email = `guard-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const signup = await page.request.post("/api/auth/signup", {
    headers: { origin: baseURL! },
    data: { email, password: "correct horse battery", displayName: "Guard" },
  });
  expect(signup.status()).toBe(201);

  const res = await page.goto("/");
  expect(new URL(page.url()).pathname).toBe("/");
  expect(res?.status()).toBe(200);
  expect(res?.headers()["cache-control"]).toContain("no-store");
});
