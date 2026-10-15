import { expect, test } from "@playwright/test";

test("health endpoint responds OK", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
});

test("home page loads for a signed-out visitor as the login redirect", async ({ request }) => {
  const res = await request.get("/", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers()["location"]).toContain("/login?next=%2F");
});
