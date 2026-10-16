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

test("organizer changes the daily limit and sees it saved", async ({ page }, testInfo) => {
  const p = testInfo.project.name;
  const email = `settings-${p}-${stamp}@example.com`;
  emails.push(email);
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByLabel("Tên hiển thị").fill("Lan");
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  const created = await page.request.post("/api/tournaments", {
    data: {
      name: `Giải Cài đặt ${p} ${stamp}`,
      description: "Bơi tới Lý Sơn",
      seasonStart: { date: "2026-11-01", time: "00:00" },
      seasonEnd: { date: "2026-11-30", time: "23:59" },
      routeId: "route01",
      routeDistanceKm: "60",
    },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();

  await page.goto(`/tournaments/${id}/manage`);
  await page.getByRole("link", { name: "Luật và cài đặt" }).click();
  await expect(page.getByLabel(/Giới hạn mỗi ngày/)).toHaveValue("10");
  await page.getByLabel(/Giới hạn mỗi ngày/).fill("6");
  await page.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Đã lưu cài đặt.")).toBeVisible();
  const row = await prisma.tournament.findUnique({ where: { id } });
  expect(row?.dailyLimitM).toBe(6000);
  await page.reload();
  await expect(page.getByLabel(/Giới hạn mỗi ngày/)).toHaveValue("6");
});
