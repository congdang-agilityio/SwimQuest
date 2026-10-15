import { expect, test, type Locator } from "@playwright/test";

const PASSWORD = "correct-horse-battery";
const LABELS = ["Trang chủ", "Giải đấu", "Đội của tôi", "Hành trình", "Hồ sơ"];

async function expectTapTarget(target: Locator) {
  const box = (await target.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThanOrEqual(44);
}

test("five destinations are visible; Profile -> Log out works", async ({ page }, testInfo) => {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(`nav-${testInfo.project.name}-${Date.now()}@example.com`);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByLabel("Tên hiển thị").fill("Lan");
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  const nav = page.getByRole("navigation", { name: "Menu chính" });
  for (const label of LABELS) await expect(nav.getByRole("link", { name: label })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Quản trị" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Trang chủ" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  const box = await nav.boundingBox();
  const viewport = page.viewportSize()!;
  if (viewport.width < 768) expect(box!.y).toBeGreaterThan(viewport.height / 2);
  else expect(box!.x).toBe(0);

  await expectTapTarget(page.locator("summary"));
  await expectTapTarget(nav.getByRole("link", { name: "Trang chủ" }));

  await nav.getByRole("link", { name: "Hồ sơ" }).click();
  await page.waitForURL((url) => url.pathname === "/profile");
  await expect(nav.getByRole("link", { name: "Hồ sơ" })).toHaveAttribute("aria-current", "page");
  await expectTapTarget(page.getByRole("link", { name: "Các lần bơi của tôi" }));
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await page.waitForURL((url) => url.pathname === "/login");
});
