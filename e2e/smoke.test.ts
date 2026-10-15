import { expect, test } from "@playwright/test";

test("health endpoint responds OK", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
});

test("home page loads", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.ok()).toBe(true);
});
