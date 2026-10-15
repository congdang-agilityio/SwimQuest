import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const PASSWORD = "correct-horse-battery";
const run = `season-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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
  const tIds = tournaments.map((t) => t.id);
  await prisma.pointsEntry.deleteMany({ where: { tournamentId: { in: tIds } } });
  await prisma.teamMember.deleteMany({ where: { tournamentId: { in: tIds } } });
  await prisma.team.deleteMany({ where: { tournamentId: { in: tIds } } });
  await prisma.tournament.deleteMany({ where: { id: { in: tIds } } });
  await prisma.session.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

test("organizer sees Active and each team's start with a locked state", async ({
  page,
}, testInfo) => {
  const email = `${run}-${testInfo.project.name}@example.com`;
  emails.push(email);
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByLabel("Tên hiển thị").fill("Lan");
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });

  const tournament = await prisma.tournament.create({
    data: {
      organizerId: user.id,
      name: `${run}-${testInfo.project.name}`,
      description: "e2e",
      status: "PUBLISHED",
      seasonStartAt: new Date(Date.now() - 86_400_000),
      seasonEndAt: new Date("2099-12-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 80_000,
    },
  });
  await prisma.team.create({
    data: {
      tournamentId: tournament.id,
      name: "Cá Heo",
      emblemKey: "dolphin",
      memberLimit: 5,
      startDestination: "son_thuy",
      startSetBy: "CAPTAIN",
    },
  });
  await prisma.team.create({
    data: { tournamentId: tournament.id, name: "Rùa Biển", emblemKey: "turtle", memberLimit: 5 },
  });

  await page.goto(`/tournaments/${tournament.id}/manage`);
  await expect(page.getByText("Đang diễn ra")).toBeVisible();
  await expect(page.getByText("Điểm xuất phát: Bãi Sơn Thủy")).toBeVisible();
  await expect(page.getByText("Chưa chọn điểm xuất phát")).toBeVisible();
  await expect(page.getByText(/Đã khóa từ/)).toHaveCount(2);
});
