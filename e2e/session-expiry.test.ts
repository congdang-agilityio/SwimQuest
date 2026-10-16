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
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  await prisma.tournament.deleteMany({ where: { organizerId: { in: ids } } });
  await prisma.session.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

test("submitting a form after the session expired asks to log in again and saves nothing", async ({
  page,
}, testInfo) => {
  const email = `session-expiry-${testInfo.project.name}-${stamp}@example.com`;
  const name = `Giải hết phiên ${testInfo.project.name} ${stamp}`;
  emails.push(email);
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByLabel("Tên hiển thị").fill("Lan");
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  await page.goto("/tournaments/new");
  await page.getByLabel("Tên giải đấu").fill(name);
  await page.getByLabel("Mô tả").fill("Bơi tới Lý Sơn");
  await page.getByLabel("Ngày").first().fill("2026-11-01");
  await page.getByLabel("Ngày").nth(1).fill("2026-11-30");
  await page.getByLabel("Quãng đường lộ trình (km)").fill("60");

  // The session ends while the form is open.
  await prisma.session.updateMany({
    where: { user: { email } },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });
  await page.getByRole("button", { name: "Tạo bản nháp" }).click();

  await page.waitForURL((url) => url.pathname === "/login");
  expect(new URL(page.url()).search).toBe("?next=%2Ftournaments%2Fnew");
  expect(await prisma.tournament.count({ where: { name } })).toBe(0);
});
