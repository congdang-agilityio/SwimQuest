import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const stamp = Date.now();
const emails: string[] = [];

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  await prisma.$disconnect();
});

const PASSWORD = "correct-horse-battery";

test("a new user sees the empty Home with join guidance and Create tournament", async ({
  page,
}, testInfo) => {
  const email = `home-${testInfo.project.name}-${stamp}@example.com`;
  emails.push(email);
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByLabel("Tên hiển thị").fill("Lan");
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  await expect(page.getByText(/liên kết mời/)).toBeVisible();
  const create = page.getByRole("link", { name: "Tạo giải đấu" });
  await expect(create).toHaveAttribute("href", "/tournaments/new");
  expect((await create.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});
