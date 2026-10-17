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
  const tIds = tournaments.map((t) => t.id);
  await prisma.pointsEntry.deleteMany({ where: { tournamentId: { in: tIds } } });
  await prisma.team.deleteMany({ where: { tournamentId: { in: tIds } } });
  await prisma.tournament.deleteMany({ where: { organizerId: { in: ids } } });
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

test("draft without teams lists the issue; with a team: preview, publish once, invite link", async ({
  page,
  browser,
}, testInfo) => {
  const p = testInfo.project.name;
  const name = `Giải Công bố ${p} ${stamp}`;
  await signUp(page, `publish-${p}-${stamp}@example.com`, "Lan");
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
  const manage = `/tournaments/${id}/manage`;

  await page.goto(manage);
  await page.getByRole("button", { name: "Công bố" }).click();
  await page.getByRole("button", { name: "Đồng ý, công bố" }).click();
  await expect(page.getByRole("link", { name: "Hãy thêm ít nhất một đội." })).toBeVisible();
  await expect(page.getByText("Bản nháp")).toBeVisible();

  const team = await page.request.post(`/api/tournaments/${id}/teams`, {
    data: { name: "Đội Rùa", emblemKey: "turtle", memberLimit: 5 },
  });
  expect(team.status()).toBe(201);

  await page.goto(manage);
  await page.getByRole("link", { name: "Xem trước" }).click();
  await page.waitForURL(/\/manage\/preview$/);
  await expect(page.getByText("Đội Rùa")).toBeVisible();

  // Publishing needs a visibility choice: follow the issue link and pick it in the browser.
  await page.goto(manage);
  await page.getByRole("button", { name: "Công bố" }).click();
  await page.getByRole("button", { name: "Đồng ý, công bố" }).click();
  await page.getByRole("link", { name: "Chọn chế độ hiển thị của giải." }).click();
  await expect(page).toHaveURL(/\/manage\/settings#visibility$/);
  await page.getByRole("radio", { name: /Chỉ qua liên kết mời/ }).check();
  await page.getByRole("button", { name: "Lưu hiển thị" }).click();
  await expect(page.getByText("Đã lưu.").first()).toBeVisible();

  await page.goto(manage);
  await page.getByRole("button", { name: "Công bố" }).click();
  const publishRequests: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/publish")) publishRequests.push(r.url());
  });
  await page.getByRole("button", { name: "Đồng ý, công bố" }).dblclick();
  await expect(page.getByText("Đang mở đăng ký")).toBeVisible();
  const link = page.getByRole("textbox", { name: "Liên kết mời" });
  await expect(link).toHaveValue(/\/join\/.+/);
  await expect(page.getByRole("button", { name: "Sao chép" })).toBeVisible();
  expect(publishRequests).toHaveLength(1);
  const tournament = await prisma.tournament.findUnique({ where: { id } });
  expect(tournament?.status).toBe("PUBLISHED");
  expect(await link.inputValue()).toMatch(new RegExp(`/join/${tournament?.inviteToken}$`));

  // a non-organizer gets not-found for the preview page (review note from #144)
  const other = await browser.newContext();
  const second = await other.newPage();
  await signUp(second, `publish-other-${p}-${stamp}@example.com`, "Minh");
  expect((await second.goto(`${manage}/preview`))?.status()).toBe(404);
  await expect(second.getByText("Đội Rùa")).toHaveCount(0);
  await other.close();
});
