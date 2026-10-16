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
  const tournaments = await prisma.tournament.findMany({
    where: { organizerId: { in: ids } },
    select: { id: true },
  });
  const tids = tournaments.map((t) => t.id);
  await prisma.teamMember.deleteMany({ where: { tournamentId: { in: tids } } });
  await prisma.team.deleteMany({ where: { tournamentId: { in: tids } } });
  await prisma.tournament.deleteMany({ where: { id: { in: tids } } });
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

test("the organizer appoints, then changes, the captain; others get not-found", async ({
  page,
  browser,
}, testInfo) => {
  const p = testInfo.project.name;
  const orgEmail = `cap-org-${p}-${stamp}@example.com`;
  await signUp(page, orgEmail, "Chủ giải");
  const memberA = await prisma.user.create({
    data: { email: `cap-a-${p}-${stamp}@example.com`, passwordHash: "x", displayName: "Lan" },
  });
  const memberB = await prisma.user.create({
    data: { email: `cap-b-${p}-${stamp}@example.com`, passwordHash: "x", displayName: "Minh" },
  });
  emails.push(memberA.email, memberB.email);

  const created = await page.request.post("/api/tournaments", {
    data: {
      name: `Giải Captain ${p} ${stamp}`,
      description: "Đội",
      seasonStart: { date: "2026-11-01", time: "00:00" },
      seasonEnd: { date: "2026-11-30", time: "23:59" },
      routeId: "route01",
      routeDistanceKm: "60",
    },
  });
  const { id } = await created.json();
  const team = await prisma.team.create({
    data: { tournamentId: id, name: "Rùa Biển", emblemKey: "turtle", memberLimit: 5 },
  });
  for (const u of [memberA, memberB]) {
    await prisma.teamMember.create({
      data: { teamId: team.id, tournamentId: id, userId: u.id },
    });
  }

  await page.goto(`/tournaments/${id}/manage`);
  await page.getByRole("link", { name: "Rùa Biển" }).click();
  await expect(page.getByRole("heading", { name: "Rùa Biển" })).toBeVisible();
  await expect(page.getByRole("button", { name: /làm đội trưởng/ })).toHaveCount(2);

  await page.getByRole("button", { name: "Chọn Lan làm đội trưởng" }).click();
  await expect(page.locator("strong", { hasText: "Đội trưởng" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Chọn Lan làm đội trưởng" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Chọn Minh làm đội trưởng" })).toBeVisible();

  await page.getByRole("button", { name: "Chọn Minh làm đội trưởng" }).click();
  await expect(page.getByRole("button", { name: "Chọn Lan làm đội trưởng" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Chọn Minh làm đội trưởng" })).toHaveCount(0);

  const other = await browser.newPage({ baseURL: testInfo.project.use.baseURL });
  await signUp(other, `cap-x-${p}-${stamp}@example.com`, "Người lạ");
  const res = await other.goto(`/tournaments/${id}/manage/teams/${team.id}`);
  expect(res?.status()).toBe(404);
  await expect(other.getByRole("button", { name: /đội trưởng/ })).toHaveCount(0);
  await other.close();
});
