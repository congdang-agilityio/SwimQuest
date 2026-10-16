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
const tournamentIds: string[] = [];

test.afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  const userId = { in: users.map((u) => u.id) };
  await prisma.pointsEntry.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
  await prisma.teamMember.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
  await prisma.team.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
  await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

async function signUp(page: import("@playwright/test").Page, email: string) {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByLabel("Tên hiển thị").fill("Lan");
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  return prisma.user.findUniqueOrThrow({ where: { email } });
}

test("two teams with points are ranked and my team is tagged; outsiders get not-found", async ({
  page,
  browser,
}, testInfo) => {
  const label = `lb-${testInfo.project.name}`;
  const email = `${label}-${stamp}@example.com`;
  const outsider = `${label}-out-${stamp}@example.com`;
  emails.push(email, outsider, `${label}-org-${stamp}@example.com`);
  const me = await signUp(page, email);
  const organizer = await prisma.user.create({
    data: { email: `${label}-org-${stamp}@example.com`, passwordHash: "x", displayName: "Org" },
  });
  const tournament = await prisma.tournament.create({
    data: {
      organizerId: organizer.id,
      name: `Giải ${label} ${stamp}`,
      description: "d",
      status: "ACTIVE",
      seasonStartAt: new Date("2026-01-01T00:00:00+07:00"),
      seasonEndAt: new Date("2099-01-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100000,
    },
  });
  tournamentIds.push(tournament.id);
  const mine = await prisma.team.create({
    data: {
      tournamentId: tournament.id,
      name: "Đội Của Tôi",
      emblemKey: "dolphin",
      memberLimit: 5,
      startDestination: "hon_sup",
      startSetBy: "CAPTAIN",
      startSetAt: new Date(),
    },
  });
  const other = await prisma.team.create({
    data: { tournamentId: tournament.id, name: "Đội Khác", emblemKey: "turtle", memberLimit: 5 },
  });
  await prisma.teamMember.create({
    data: { tournamentId: tournament.id, teamId: mine.id, userId: me.id, status: "ACTIVE" },
  });
  // The other team has more points (route = 1000 points).
  for (const [team, points] of [
    [mine, 100],
    [other, 400],
  ] as const) {
    await prisma.pointsEntry.create({
      data: {
        tournamentId: tournament.id,
        teamId: team.id,
        userId: team === mine ? me.id : organizer.id,
        kind: "DISTANCE",
        points,
        vnDay: "2026-11-02",
      },
    });
  }

  await page.goto("/voyage");
  await page.getByRole("link", { name: "Bảng xếp hạng" }).click();
  await expect(page).toHaveURL(new RegExp(`/tournaments/${tournament.id}/leaderboard$`));
  await expect(page.getByRole("tab", { name: "Tiến độ" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText(/Xếp hạng tiến độ trên lộ trình/)).toBeVisible();
  const rows = page.getByRole("row");
  await expect(rows.nth(1)).toContainText("Đội Khác");
  await expect(rows.nth(2)).toContainText("Đội Của Tôi");
  await expect(rows.nth(2)).toContainText("Đội của bạn");
  await expect(rows.nth(1)).not.toContainText("Đội của bạn");

  const ctx = await browser.newContext();
  const page2 = await ctx.newPage();
  await signUp(page2, outsider);
  const res = await page2.goto(`/tournaments/${tournament.id}/leaderboard`);
  expect(res?.status()).toBe(404);
  await ctx.close();
});
