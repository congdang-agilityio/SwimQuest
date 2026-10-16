import { existsSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
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
  await prisma.tournament.deleteMany({ where: { organizerId: { in: ids } } });
  await prisma.session.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

async function organizerWithTournament(page: Page, testInfo: TestInfo, tag: string) {
  const p = testInfo.project.name;
  const email = `settings-${tag}-${p}-${stamp}@example.com`;
  emails.push(email);
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByLabel("Tên hiển thị").fill("Lan");
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  const created = await page.request.post("/api/tournaments", {
    data: {
      name: `Giải Cài đặt ${tag} ${p} ${stamp}`,
      description: "Bơi tới Lý Sơn",
      seasonStart: { date: "2026-11-01", time: "00:00" },
      seasonEnd: { date: "2026-11-30", time: "23:59" },
      routeId: "route01",
      routeDistanceKm: "60",
    },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  return id as string;
}

test("organizer changes the daily limit and sees it saved", async ({ page }, testInfo) => {
  const id = await organizerWithTournament(page, testInfo, "swim");
  await page.goto(`/tournaments/${id}/manage`);
  await page.getByRole("link", { name: "Luật và cài đặt" }).click();
  await expect(page.getByLabel(/Giới hạn mỗi ngày/)).toHaveValue("10");
  await page.getByLabel(/Giới hạn mỗi ngày/).fill("6");
  const swimForm = page.getByRole("form", { name: "Giới hạn bơi" });
  await swimForm.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(swimForm.getByText("Đã lưu cài đặt.")).toBeVisible();
  const row = await prisma.tournament.findUnique({ where: { id } });
  expect(row?.dailyLimitM).toBe(6000);
  await page.reload();
  await expect(page.getByLabel(/Giới hạn mỗi ngày/)).toHaveValue("6");
});

test("organizer sets the start choice deadline and goes back to the season start", async ({
  page,
}, testInfo) => {
  const id = await organizerWithTournament(page, testInfo, "deadlines");
  await page.goto(`/tournaments/${id}/manage/settings`);
  const form = page.getByRole("form", { name: "Hạn chót" });
  const date = form.getByLabel("Hạn chọn điểm xuất phát: ngày");
  const time = form.getByLabel("Hạn chọn điểm xuất phát: giờ");
  const save = form.getByRole("button", { name: "Lưu hạn chót", exact: true });
  await expect(date).toHaveValue("");
  await form.getByLabel(/Số ngày được tải buổi bơi lên/).fill("5");
  await date.fill("2026-10-30");
  await time.fill("20:30");
  await save.click();
  await expect(form.getByText("Đã lưu hạn chót.")).toBeVisible();
  let row = await prisma.tournament.findUnique({ where: { id } });
  expect(row?.submissionDays).toBe(5);
  expect(row?.startChoiceDeadlineAt?.toISOString()).toBe("2026-10-30T13:30:00.000Z");

  await page.reload();
  await expect(date).toHaveValue("2026-10-30");
  await expect(time).toHaveValue("20:30");
  await expect(form.getByLabel(/Số ngày được tải buổi bơi lên/)).toHaveValue("5");

  await form.getByRole("button", { name: "Dùng lúc mùa giải bắt đầu" }).click();
  await expect(date).toHaveValue("");
  await save.click();
  await expect(form.getByText("Đã lưu hạn chót.")).toBeVisible();
  row = await prisma.tournament.findUnique({ where: { id } });
  expect(row?.startChoiceDeadlineAt).toBeNull();
});
