import { expect, test } from "@playwright/test";

test("sign up signs in and redirects; the same email is refused with a login link", async ({
  page,
  browser,
}, testInfo) => {
  const email = `signup-${testInfo.project.name}-${Date.now()}@example.com`;
  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: "Tạo tài khoản" })).toBeVisible();
  await expect(page.getByLabel("Mật khẩu")).toBeVisible();

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill("correct-horse-battery");
  await page.getByLabel("Tên hiển thị").fill("Lan");
  await page.getByRole("button", { name: "Đăng ký" }).click();

  await page.waitForURL("**/home");
  const cookies = await page.context().cookies();
  expect(cookies.some((c) => c.httpOnly && /session/i.test(c.name))).toBe(true);

  const second = await browser.newContext();
  const again = await second.newPage();
  await again.goto("/signup");
  await again.getByLabel("Email").fill(email);
  await again.getByLabel("Mật khẩu").fill("correct-horse-battery");
  await again.getByLabel("Tên hiển thị").fill("Lan 2");
  await again.getByRole("button", { name: "Đăng ký" }).click();
  await expect(again.getByText("Bạn không thể dùng email này.")).toBeVisible();
  await expect(again.getByRole("link", { name: "Đăng nhập" }).first()).toHaveAttribute(
    "href",
    "/login",
  );
  await second.close();
});
