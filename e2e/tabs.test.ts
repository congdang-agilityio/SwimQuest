import { expect, test } from "@playwright/test";

const PASSWORD = "correct-horse-battery";

test("a new user sees the join guidance / create button on each tab", async ({
  page,
}, testInfo) => {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(`tabs-${testInfo.project.name}-${Date.now()}@example.com`);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByLabel("Tên hiển thị").fill("Lan");
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  await page.goto("/tournaments");
  await expect(page.getByRole("heading", { name: "Giải đấu", level: 1 })).toBeVisible();
  await expect(page.getByText("Bạn chưa có giải đấu nào.")).toBeVisible();
  const create = page.getByRole("link", { name: "Tạo giải đấu" });
  await expect(create).toHaveAttribute("href", "/tournaments/new");
  expect((await create.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  for (const path of ["/team", "/voyage"]) {
    await page.goto(path);
    await expect(page.getByText("Bạn chưa tham gia giải đấu nào")).toBeVisible();
    await expect(page.getByText(/liên kết mời/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Tạo giải đấu" })).toHaveAttribute(
      "href",
      "/tournaments/new",
    );
  }
});
