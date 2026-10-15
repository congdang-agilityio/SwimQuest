import { expect, test, type Page, type Response } from "@playwright/test";

const PASSWORD = "correct-horse-battery";

/** Waits for the next top-level navigation to the home page `/`. */
function homeLanding(page: Page): Promise<Response> {
  return page.waitForResponse(
    (res) => res.request().isNavigationRequest() && new URL(res.url()).pathname === "/",
  );
}

/** The home page `/` really exists: no error status, no 404 text, the app heading shows. */
async function expectHomePage(page: Page, landing: Response) {
  expect(new URL(page.url()).pathname).toBe("/");
  expect(landing.status()).toBeLessThan(400);
  await expect(page.getByText("This page could not be found")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "SwimQuest" })).toBeVisible();
}

test("login returns to the requested page; logout leaves no protected page in history", async ({
  page,
}, testInfo) => {
  const email = `login-${testInfo.project.name}-${Date.now()}@example.com`;

  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByLabel("Tên hiển thị").fill("Lan");
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  const signedInLanding = homeLanding(page);
  await page.goto("/login");
  await page.waitForURL((url) => url.pathname === "/" && url.search === "");
  await expectHomePage(page, await signedInLanding);

  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await page.waitForURL((url) => url.pathname === "/login");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  const loginLanding = homeLanding(page);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL((url) => url.pathname === "/" && url.search === "");
  await expectHomePage(page, await loginLanding);

  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await page.waitForURL((url) => url.pathname === "/login");

  await page.goto("/?from=login");
  await page.waitForURL((url) => url.pathname === "/login");
  expect(new URL(page.url()).searchParams.get("next")).toBe("/?from=login");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill("wrong-password-1");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByText("Email hoặc mật khẩu không đúng.")).toBeVisible();

  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL((url) => url.pathname === "/" && url.search === "?from=login");
  await expect(page.getByRole("heading", { name: "SwimQuest" })).toBeVisible();

  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await page.waitForURL((url) => url.pathname === "/login");
  await page.goBack();
  await page.waitForURL((url) => url.pathname === "/login" || url.pathname === "/");
  await expect(page.getByRole("heading", { name: "SwimQuest" })).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe("/login");
});

test("an unknown email gets the same generic message", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(`nobody-${Date.now()}@example.com`);
  await page.getByLabel("Mật khẩu").fill("wrong-password-1");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByText("Email hoặc mật khẩu không đúng.")).toBeVisible();
});
