import { existsSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
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
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

async function signUp(page: Page, email: string, name: string) {
  emails.push(email);
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByLabel("Tên hiển thị").fill(name);
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await page.waitForURL((url) => url.pathname === "/");
}

test("the organizer sees the draft; another player and unknown ids get not-found", async ({
  page,
  browser,
}, testInfo) => {
  const p = testInfo.project.name;
  const name = `Giải Thu ${p} ${stamp}`;
  await signUp(page, `organizer-page-${p}-${stamp}@example.com`, "Lan");
  const created = await page.request.post("/api/tournaments", {
    data: {
      name,
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
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  await expect(page.getByText("Bản nháp")).toBeVisible();
  await expect(page.getByText(/00:00 2026-11-01 - 23:59 2026-11-30/)).toBeVisible();

  const other = await browser.newContext();
  const second = await other.newPage();
  await signUp(second, `organizer-page-other-${p}-${stamp}@example.com`, "Minh");
  const res = await second.goto(`/tournaments/${id}/manage`);
  expect(res?.status()).toBe(404);
  await expect(second.getByText(name)).toHaveCount(0);
  expect((await second.goto("/tournaments/unknown-id/manage"))?.status()).toBe(404);
  await other.close();
});
