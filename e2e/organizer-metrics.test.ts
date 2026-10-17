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
  const tournaments = { organizerId: { in: ids } };
  await prisma.teamMember.deleteMany({ where: { team: { tournament: tournaments } } });
  await prisma.team.deleteMany({ where: { tournament: tournaments } });
  await prisma.tournament.deleteMany({ where: tournaments });
  await prisma.session.deleteMany({ where: { userId: { in: ids } } });
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

test("the organizer opens Metrics from the console; a player gets access denied", async ({
  page,
  browser,
}, testInfo) => {
  const p = testInfo.project.name;
  await signUp(page, `organizer-metrics-${p}-${stamp}@example.com`, "Lan");
  const created = await page.request.post("/api/tournaments", {
    data: {
      name: `Giải Số liệu ${p} ${stamp}`,
      description: "Số liệu",
      seasonStart: { date: "2030-01-01", time: "00:00" },
      seasonEnd: { date: "2030-12-31", time: "23:59" },
      routeId: "route01",
      routeDistanceKm: "60",
    },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  const team = await page.request.post(`/api/tournaments/${id}/teams`, {
    data: { name: "Cá Heo", emblemKey: "turtle", memberLimit: 5 },
  });
  expect(team.status()).toBe(201);

  await page.goto(`/tournaments/${id}/manage`);
  await page.getByRole("link", { name: "Số liệu" }).click();
  await expect(page.getByRole("heading", { name: "Số liệu", level: 1 })).toBeVisible();
  await expect(page.getByText("Chưa có buổi bơi nào")).toBeVisible();

  const other = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
  const otherPage = await other.newPage();
  await signUp(otherPage, `player-metrics-${p}-${stamp}@example.com`, "Minh");
  await otherPage.goto(`/tournaments/${id}/manage/metrics`);
  await expect(
    otherPage.getByRole("heading", { name: "Bạn không có quyền truy cập" }),
  ).toBeVisible();
  await other.close();
});
