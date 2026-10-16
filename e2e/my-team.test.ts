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
  const tournaments = (
    await prisma.tournament.findMany({ where: { organizerId: { in: ids } }, select: { id: true } })
  ).map((t) => t.id);
  const teams = (
    await prisma.team.findMany({
      where: { tournamentId: { in: tournaments } },
      select: { id: true },
    })
  ).map((t) => t.id);
  const swims = (
    await prisma.swim.findMany({ where: { userId: { in: ids } }, select: { id: true } })
  ).map((s) => s.id);
  await prisma.pointsEntry.deleteMany({
    where: { OR: [{ teamId: { in: teams } }, { userId: { in: ids } }] },
  });
  await prisma.swimResult.deleteMany({ where: { swimId: { in: swims } } });
  await prisma.swim.deleteMany({ where: { id: { in: swims } } });
  await prisma.teamMember.deleteMany({
    where: { OR: [{ userId: { in: ids } }, { teamId: { in: teams } }] },
  });
  await prisma.team.deleteMany({ where: { id: { in: teams } } });
  await prisma.tournament.deleteMany({ where: { id: { in: tournaments } } });
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

test("after joining, My Team shows the team, 1 / limit and the player; a verified swim adds km and points", async ({
  page,
  browser,
  baseURL,
}, testInfo) => {
  const p = testInfo.project.name;
  await signUp(page, `myteam-org-${p}-${stamp}@example.com`, "Chủ giải");
  const created = await page.request.post("/api/tournaments", {
    data: {
      name: `Giải Đội ${p} ${stamp}`,
      description: "Đội",
      seasonStart: { date: "2030-01-01", time: "00:00" },
      seasonEnd: { date: "2030-12-31", time: "23:59" },
      routeId: "route01",
      routeDistanceKm: "60",
    },
  });
  const { id } = await created.json();
  await page.request.post(`/api/tournaments/${id}/teams`, {
    data: { name: "Rùa Biển", emblemKey: "turtle", memberLimit: 5 },
  });
  expect((await page.request.post(`/api/tournaments/${id}/publish`)).ok()).toBe(true);
  const { inviteToken } = await prisma.tournament.findUniqueOrThrow({ where: { id } });

  const context = await browser.newContext({ baseURL });
  const player = await context.newPage();
  await player.goto("/signup");
  emails.push(`myteam-player-${p}-${stamp}@example.com`);
  await player.getByLabel("Email").fill(`myteam-player-${p}-${stamp}@example.com`);
  await player.getByLabel("Mật khẩu").fill(PASSWORD);
  await player.getByLabel("Tên hiển thị").fill("Người chơi");
  await player.getByRole("button", { name: "Đăng ký" }).click();
  await player.waitForURL((url) => url.pathname === "/");
  await player.goto(`/join/${inviteToken}`);
  await player.getByRole("button", { name: "Tham gia Rùa Biển" }).click();
  await player.waitForURL((url) => url.pathname === "/team");

  await expect(player.getByText("Thành viên: 1 / 5")).toBeVisible();
  const row = player.getByRole("listitem").filter({ hasText: "Người chơi" });
  await expect(row).toContainText("0 km");
  await expect(player.getByRole("link", { name: "Thêm buổi bơi" })).toHaveAttribute(
    "href",
    "/connect",
  );

  const user = await prisma.user.findUniqueOrThrow({
    where: { email: `myteam-player-${p}-${stamp}@example.com` },
  });
  const team = await prisma.team.findFirstOrThrow({ where: { tournamentId: id } });
  const swim = await prisma.swim.create({
    data: {
      userId: user.id,
      source: "GPX",
      fileSha256: `sha-${p}-${stamp}`,
      originalFilename: "a.gpx",
      startedAt: new Date("2030-02-01T01:00:00Z"),
      endedAt: new Date("2030-02-01T02:00:00Z"),
      distanceM: 1500,
      durationS: 3600,
      swimType: "POOL",
      sport: "swimming",
      isSwim: true,
    },
  });
  const result = await prisma.swimResult.create({
    data: {
      swimId: swim.id,
      tournamentId: id,
      teamId: team.id,
      userId: user.id,
      status: "VERIFIED",
      reasons: [],
      countedM: 1500,
    },
  });
  await prisma.pointsEntry.create({
    data: {
      tournamentId: id,
      userId: user.id,
      teamId: team.id,
      swimResultId: result.id,
      kind: "DISTANCE",
      points: 15,
      countedM: 1500,
      vnDay: "2030-02-01",
    },
  });
  await player.reload();
  await expect(row).toContainText("1.5 km");
  await expect(row).toContainText("15 điểm");
  await context.close();
});
