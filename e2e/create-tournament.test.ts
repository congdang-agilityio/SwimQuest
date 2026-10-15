import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const PASSWORD = "correct-horse-battery";
const stamp = Date.now();
const emails: string[] = [];

test.afterAll(async () => {
  // Tournaments (and their teams) cascade from the organizer; sessions cascade from the user.
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  await prisma.tournament.deleteMany({ where: { organizerId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

async function signUp(page: import("@playwright/test").Page, email: string, name: string) {
  emails.push(email);
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByLabel("Tên hiển thị").fill(name);
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await page.waitForURL((url) => url.pathname === "/");
}

test("create a draft from the Tournaments tab; a second user cannot open it", async ({
  page,
  browser,
}, testInfo) => {
  const p = testInfo.project.name;
  await signUp(page, `create-t-${p}-${stamp}@example.com`, "Lan");
  await page.goto("/tournaments");
  await page.getByRole("link", { name: "Tạo giải đấu" }).click();
  await page.waitForURL((url) => url.pathname === "/tournaments/new");

  await page.getByLabel("Tên giải đấu").fill(`Giải Hè ${p}`);
  await page.getByLabel("Mô tả").fill("Bơi tới Lý Sơn");
  await page.getByLabel("Ngày").first().fill("2026-11-30");
  await page.getByLabel("Ngày").nth(1).fill("2026-11-01");
  await page.getByLabel("Quãng đường lộ trình (km)").fill("60");
  await page.getByRole("button", { name: "Tạo bản nháp" }).click();

  // End before start: the error is at the field and the other entries stay.
  await expect(page.getByText("Thời điểm kết thúc phải sau thời điểm bắt đầu.")).toBeVisible();
  await expect(page.getByLabel("Tên giải đấu")).toHaveValue(`Giải Hè ${p}`);
  await expect(page.getByLabel("Quãng đường lộ trình (km)")).toHaveValue("60");

  await page.getByLabel("Ngày").first().fill("2026-11-01");
  await page.getByLabel("Ngày").nth(1).fill("2026-11-30");
  await expect(page.getByLabel(/Giờ \(giờ Việt Nam/).first()).toHaveValue("00:00");
  await expect(page.getByLabel(/Giờ \(giờ Việt Nam/).nth(1)).toHaveValue("23:59");
  await page.getByRole("button", { name: "Tạo bản nháp" }).click();

  await page.waitForURL(/\/tournaments\/[^/]+\/manage$/);
  await expect(page.getByRole("heading", { name: `Giải Hè ${p}`, level: 1 })).toBeVisible();
  await expect(page.getByText("Bản nháp")).toBeVisible();
  await expect(page.getByText(/00:00 2026-11-01 - 23:59 2026-11-30/)).toBeVisible();
  const manageUrl = page.url();

  const other = await browser.newContext();
  const second = await other.newPage();
  await signUp(second, `create-t-other-${p}-${stamp}@example.com`, "Minh");
  const res = await second.goto(manageUrl);
  expect(res?.status()).toBe(404);
  await expect(second.getByText("Giải Hè")).toHaveCount(0);
  await other.close();
});
