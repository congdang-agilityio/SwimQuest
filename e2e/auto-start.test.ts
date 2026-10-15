import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const PASSWORD = "correct-horse-battery";
const run = `auto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const email = `${run}@example.com`;

test.afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const tournaments = await prisma.tournament.findMany({
    where: { organizerId: { in: ids } },
    select: { id: true },
  });
  const tIds = tournaments.map((t) => t.id);
  await prisma.teamMember.deleteMany({ where: { tournamentId: { in: tIds } } });
  await prisma.team.deleteMany({ where: { tournamentId: { in: tIds } } });
  await prisma.tournament.deleteMany({ where: { id: { in: tIds } } });
  await prisma.session.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

test("a team with no start after the deadline gets one assigned automatically and cannot change it", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByLabel("Tên hiển thị").fill("captain");
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const tournament = await prisma.tournament.create({
    data: {
      organizerId: user.id,
      name: run,
      description: "e2e",
      status: "PUBLISHED",
      seasonStartAt: new Date("2020-01-01T06:00:00+07:00"),
      seasonEndAt: new Date("2099-12-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 80_000,
    },
  });
  const team = await prisma.team.create({
    data: {
      tournamentId: tournament.id,
      name: "Cá Mập",
      emblemKey: "dolphin",
      memberLimit: 5,
      captainUserId: user.id,
    },
  });
  await prisma.teamMember.create({
    data: { teamId: team.id, tournamentId: tournament.id, userId: user.id, status: "ACTIVE" },
  });

  await page.goto("/team");
  await expect(page.getByText(/Được gán tự động lúc/)).toBeVisible();
  await expect(page.getByText(/Đã khóa từ/)).toBeVisible();
  await expect(page.getByRole("link", { name: /điểm xuất phát/ })).toHaveCount(0);
  const saved = await prisma.team.findUniqueOrThrow({ where: { id: team.id } });
  expect(saved.startSetBy).toBe("AUTOMATIC");
  expect(saved.startDestination).not.toBeNull();

  await page.goto(`/tournaments/${tournament.id}/manage`);
  await expect(page.getByText(/Được gán tự động lúc/)).toBeVisible();
});
