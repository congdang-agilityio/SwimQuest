import { expect, test } from "@playwright/test";

test("health endpoint responds OK", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
});

test("the main address sends a signed-out visitor to the welcome page", async ({ request }) => {
  const res = await request.get("/", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(new URL(res.headers()["location"] ?? "", "http://x").pathname).toBe("/welcome");
});
