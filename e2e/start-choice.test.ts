import { existsSync } from "node:fs";
import { expect, test, type Browser } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const PASSWORD = "correct-horse-battery";
const run = `start-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const emails: string[] = [];

async function signUp(browser: Browser, label: string) {
  const email = `${run}-${label}@example.com`;
  emails.push(email);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByLabel("Tên hiển thị").fill(label);
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return { context, page, user };
}

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
  await prisma.teamMember.deleteMany({ where: { tournamentId: { in: tIds } } });
  await prisma.team.deleteMany({ where: { tournamentId: { in: tIds } } });
  await prisma.tournament.deleteMany({ where: { id: { in: tIds } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

test("the captain chooses and changes the start; a member sees it on My Team", async ({
  browser,
}) => {
  const captain = await signUp(browser, "captain");
  const member = await signUp(browser, "member");
  const tournament = await prisma.tournament.create({
    data: {
      organizerId: captain.user.id,
      name: run,
      description: "e2e",
      status: "PUBLISHED",
      seasonStartAt: new Date("2099-11-01T06:00:00+07:00"),
      seasonEndAt: new Date("2099-12-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 80_000,
    },
  });
  const team = await prisma.team.create({
    data: {
      tournamentId: tournament.id,
      name: "Cá Heo",
      emblemKey: "dolphin",
      memberLimit: 5,
      captainUserId: captain.user.id,
    },
  });
  for (const u of [captain.user, member.user])
    await prisma.teamMember.create({
      data: { teamId: team.id, tournamentId: tournament.id, userId: u.id, status: "ACTIVE" },
    });

  const page = captain.page;
  await page.goto("/team");
  await expect(page.getByText("Chưa chọn điểm xuất phát")).toBeVisible();
  await page.getByRole("link", { name: "Chọn điểm xuất phát" }).click();
  await page.waitForURL((url) => url.pathname === "/team/start");
  await expect(page.getByRole("radio", { name: /Lý Sơn/ })).toBeDisabled();

  await page.getByRole("radio", { name: /Bãi Sơn Thủy/ }).check();
  await page.getByRole("button", { name: "Xác nhận" }).click();
  await expect(page.getByRole("status")).toContainText("Bãi Sơn Thủy");
  await expect(page.getByRole("status")).toContainText("06:00 01/11/2099");

  await page.getByRole("radio", { name: /Hòn Sụp/ }).check();
  await page.getByRole("button", { name: "Xác nhận" }).click();
  await expect(page.getByRole("status")).toContainText("Hòn Sụp");
  expect((await prisma.team.findUniqueOrThrow({ where: { id: team.id } })).startDestination).toBe(
    "hon_sup",
  );

  await member.page.goto("/team");
  await expect(member.page.getByText("Hòn Sụp")).toBeVisible();
  await expect(member.page.getByRole("link", { name: /điểm xuất phát/ })).toHaveCount(0);
  await member.page.goto("/team/start");
  await expect(member.page.getByRole("radio", { name: /Hòn Sụp/ })).toBeChecked();
  await expect(member.page.getByRole("radio", { name: /Bãi Sơn Thủy/ })).toBeDisabled();
  await expect(member.page.getByRole("button", { name: "Xác nhận" })).toHaveCount(0);

  await captain.context.close();
  await member.context.close();
});
