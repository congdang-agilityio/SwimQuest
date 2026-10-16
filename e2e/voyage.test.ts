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
  // Points entries reference swim results, so they go first.
  await prisma.pointsEntry.deleteMany({ where: { userId } });
  await prisma.swimResult.deleteMany({ where: { userId } });
  await prisma.swim.deleteMany({ where: { userId } });
  await prisma.teamMember.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
  await prisma.team.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
  await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

test("a verified swim moves the label and the ship after a refresh", async ({ page }, testInfo) => {
  const label = `voyage-${testInfo.project.name}`;
  const email = `${label}-${stamp}@example.com`;
  const orgEmail = `${label}-org-${stamp}@example.com`;
  emails.push(email, orgEmail);
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByLabel("Tên hiển thị").fill("Lan");
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  const me = await prisma.user.findUniqueOrThrow({ where: { email } });
  const organizer = await prisma.user.create({
    data: { email: orgEmail, passwordHash: "x", displayName: "Org" },
  });
  const tournament = await prisma.tournament.create({
    data: {
      organizerId: organizer.id,
      name: `Giải hành trình ${label} ${stamp}`,
      description: "d",
      status: "ACTIVE",
      seasonStartAt: new Date("2026-01-01T00:00:00+07:00"),
      seasonEndAt: new Date("2099-01-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100000,
      fastestPaceSecPer100m: 30,
    },
  });
  tournamentIds.push(tournament.id);
  const team = await prisma.team.create({
    data: {
      tournamentId: tournament.id,
      name: "Đội",
      emblemKey: "dolphin",
      memberLimit: 5,
      startDestination: "hon_sup",
      startSetBy: "CAPTAIN",
      startSetAt: new Date(),
    },
  });
  await prisma.teamMember.create({
    data: { tournamentId: tournament.id, teamId: team.id, userId: me.id, status: "ACTIVE" },
  });

  await page.goto("/voyage");
  await expect(page.getByTestId("progress-label")).toHaveText("0 / 100 km hành trình · 0%");
  await expect(page.getByTestId("ship")).toBeVisible();
  await expect(page.getByTestId("route-path")).toBeAttached();
  await expect(page.getByTestId("destination-ly_son")).toContainText("Lý Sơn");
  await expect(page.getByText(/không phải hải đồ/)).toBeVisible();
  const before = await page.getByTestId("ship").boundingBox();

  await page.goto("/connect");
  await page
    .getByLabel("Tải lên tệp GPX/FIT")
    .setInputFiles("src/server/swims/parse/__tests__/fixtures/open-water.gpx");
  await page.getByRole("button", { name: "Tải lên", exact: true }).click();
  await expect(page.getByText("Đã xác nhận")).toBeVisible();

  await page.goto("/voyage");
  await expect(page.getByTestId("progress-label")).not.toHaveText("0 / 100 km hành trình · 0%");
  await expect(page.getByTestId("progress-label")).toContainText("/ 100 km hành trình");
  const after = await page.getByTestId("ship").boundingBox();
  expect(after).not.toEqual(before);
});

test("a team without a start sees the notice, no path and no ship", async ({ page }, testInfo) => {
  const label = `voyage-nostart-${testInfo.project.name}`;
  const email = `${label}-${stamp}@example.com`;
  emails.push(email, `${label}-org-${stamp}@example.com`);
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByLabel("Tên hiển thị").fill("Lan");
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  const me = await prisma.user.findUniqueOrThrow({ where: { email } });
  const organizer = await prisma.user.create({
    data: { email: `${label}-org-${stamp}@example.com`, passwordHash: "x", displayName: "Org" },
  });
  const tournament = await prisma.tournament.create({
    data: {
      organizerId: organizer.id,
      name: `Giải ${label} ${stamp}`,
      description: "d",
      status: "PUBLISHED",
      seasonStartAt: new Date("2098-01-01T00:00:00+07:00"),
      seasonEndAt: new Date("2099-01-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100000,
    },
  });
  tournamentIds.push(tournament.id);
  const team = await prisma.team.create({
    data: { tournamentId: tournament.id, name: "Đội", emblemKey: "dolphin", memberLimit: 5 },
  });
  await prisma.teamMember.create({
    data: { tournamentId: tournament.id, teamId: team.id, userId: me.id, status: "ACTIVE" },
  });
  await page.goto("/voyage");
  await expect(page.getByTestId("no-start")).toHaveText("Chưa chọn điểm xuất phát");
  await expect(page.getByTestId("ship")).toHaveCount(0);
  await expect(page.getByTestId("route-path")).toHaveCount(0);
});
