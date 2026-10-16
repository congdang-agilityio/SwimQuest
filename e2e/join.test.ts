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

async function fillSignUp(page: Page, email: string, name: string) {
  emails.push(email);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByLabel("Tên hiển thị").fill(name);
  await page.getByRole("button", { name: "Đăng ký" }).click();
}

test("a new player signs up from the invite link, joins a team and sees it again later", async ({
  page,
  browser,
  baseURL,
}, testInfo) => {
  const p = testInfo.project.name;
  await page.goto("/signup");
  await fillSignUp(page, `join-org-${p}-${stamp}@example.com`, "Chủ giải");
  await page.waitForURL((url) => url.pathname === "/");

  const created = await page.request.post("/api/tournaments", {
    data: {
      name: `Giải Tham Gia ${p} ${stamp}`,
      description: "Tham gia",
      seasonStart: { date: "2030-01-01", time: "00:00" },
      seasonEnd: { date: "2030-12-31", time: "23:59" },
      routeId: "route01",
      routeDistanceKm: "60",
    },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  const chosen = await page.request.patch(`/api/tournaments/${id}/settings`, {
    data: { group: "visibility", values: { visibility: "INVITE_ONLY" } },
  });
  expect(chosen.ok()).toBe(true);
  const team = await page.request.post(`/api/tournaments/${id}/teams`, {
    data: { name: "Rùa Biển", emblemKey: "turtle", memberLimit: 5 },
  });
  expect(team.status()).toBe(201);
  expect((await page.request.post(`/api/tournaments/${id}/publish`)).ok()).toBe(true);
  const { inviteToken } = await prisma.tournament.findUniqueOrThrow({ where: { id } });
  const link = `/join/${inviteToken}`;

  const context = await browser.newContext({ baseURL });
  const player = await context.newPage();
  await player.goto(link);
  await expect(player).toHaveURL(
    (url) => url.pathname === "/login" && url.searchParams.get("next") === link,
  );
  await player.getByRole("link", { name: "Đăng ký" }).click();
  await fillSignUp(player, `join-player-${p}-${stamp}@example.com`, "Người chơi");
  await player.waitForURL((url) => url.pathname === link);

  await expect(player.getByRole("heading", { name: `Giải Tham Gia ${p} ${stamp}` })).toBeVisible();
  await player.getByRole("button", { name: "Tham gia Rùa Biển" }).click();
  await player.waitForURL((url) => url.pathname === "/team");
  await expect(player.getByText("Rùa Biển")).toBeVisible();

  await player.goto(link);
  await expect(player.getByText("Bạn đang ở đội Rùa Biển")).toBeVisible();
  await expect(player.getByRole("button", { name: /Tham gia/ })).toHaveCount(0);
  await context.close();

  // A link with ?team= preselects that team; an unknown id is ignored.
  const { id: teamId } = await prisma.team.findFirstOrThrow({
    where: { tournamentId: id },
    select: { id: true },
  });
  const ctx2 = await browser.newContext({ baseURL });
  const second = await ctx2.newPage();
  await second.goto("/signup");
  await fillSignUp(second, `join-player2-${p}-${stamp}@example.com`, "Người chơi hai");
  await second.waitForURL((url) => url.pathname === "/");
  await second.goto(`${link}?team=nope`);
  await expect(second.getByText("Đã chọn")).toHaveCount(0);
  await second.goto(`${link}?team=${teamId}`);
  await expect(second.getByText("Đã chọn")).toBeVisible();
  await second.getByRole("button", { name: "Tham gia Rùa Biển" }).click();
  await second.waitForURL((url) => url.pathname === "/team");
  await ctx2.close();
});
