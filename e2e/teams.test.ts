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
  await prisma.team.deleteMany({ where: { tournamentId: { in: tournaments.map((t) => t.id) } } });
  await prisma.tournament.deleteMany({ where: { organizerId: { in: ids } } });
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

async function addTeam(page: Page, name: string, emblem: string, limit: string) {
  await page.getByRole("button", { name: "Thêm đội" }).click();
  await page.getByLabel("Tên đội").fill(name);
  await page.getByRole("radio", { name: emblem }).check();
  await page.getByLabel("Số thành viên tối đa").fill(limit);
  await page.getByRole("button", { name: "Lưu đội" }).click();
}

test("the organizer creates, edits and deletes teams and sees the capacity", async ({
  page,
}, testInfo) => {
  const p = testInfo.project.name;
  await signUp(page, `teams-${p}-${stamp}@example.com`, "Lan");
  const created = await page.request.post("/api/tournaments", {
    data: {
      name: `Giải Đội ${p} ${stamp}`,
      description: "Đội",
      seasonStart: { date: "2026-11-01", time: "00:00" },
      seasonEnd: { date: "2026-11-30", time: "23:59" },
      routeId: "route01",
      routeDistanceKm: "60",
    },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  await page.goto(`/tournaments/${id}/manage`);

  await addTeam(page, "Rùa Biển", "Rùa", "5");
  await expect(page.getByText("0 / 5")).toBeVisible();
  await addTeam(page, "Cá Heo", "Cá heo", "10");
  await expect(page.getByText("0 / 10")).toBeVisible();
  await expect(page.getByText("Sức chứa: 15 chỗ")).toBeVisible();

  await page.getByRole("button", { name: "Sửa" }).first().click();
  await expect(page.getByLabel("Tên đội")).toHaveValue("Rùa Biển");
  await page.getByLabel("Số thành viên tối đa").fill("7");
  await page.getByRole("button", { name: "Lưu đội" }).click();
  await expect(page.getByText("0 / 7")).toBeVisible();
  await expect(page.getByText("Sức chứa: 17 chỗ")).toBeVisible();

  await page.getByRole("button", { name: "Xóa", exact: true }).last().click();
  await page.getByRole("button", { name: "Xác nhận xóa" }).click();
  await expect(page.getByText("Cá Heo")).toHaveCount(0);
  await expect(page.getByText("Sức chứa: 7 chỗ")).toBeVisible();
});
