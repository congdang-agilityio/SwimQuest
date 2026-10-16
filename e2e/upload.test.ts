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
const tournamentIds: string[] = [];

test.afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  const userId = { in: users.map((u) => u.id) };
  // Points entries reference swim results, so they go first.
  await prisma.xpEntry.deleteMany({ where: { userId } });
  await prisma.pointsEntry.deleteMany({ where: { userId } });
  await prisma.swimResult.deleteMany({ where: { userId } });
  await prisma.swim.deleteMany({ where: { userId } });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.teamMember.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
  await prisma.team.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
  await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

async function signUp(page: Page, label: string) {
  const email = `upload-ui-${label}-${stamp}@example.com`;
  emails.push(email);
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByLabel("Tên hiển thị").fill("Lan");
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await page.waitForURL((url) => url.pathname === "/");
}

test("a GPX upload shows the swim details", async ({ page }, testInfo) => {
  await signUp(page, `ok-${testInfo.project.name}`);
  await page.goto("/connect");
  await page
    .getByLabel("Tải lên tệp GPX/FIT")
    .setInputFiles("src/server/swims/parse/__tests__/fixtures/open-water.gpx");
  await page.getByRole("button", { name: "Tải lên", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Buổi bơi đã lưu" })).toBeVisible();
  await expect(page.getByText("Bơi ngoài trời")).toBeVisible();
  await expect(page.getByText("Quãng đường")).toBeVisible();
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
});

test("a text file shows an error with an export hint and nothing saved", async ({
  page,
}, testInfo) => {
  await signUp(page, `bad-${testInfo.project.name}`);
  await page.goto("/connect");
  await page.getByLabel("Tải lên tệp GPX/FIT").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a swim"),
  });
  await page.getByRole("button", { name: "Tải lên", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("không được hỗ trợ");
  await expect(page.locator("main").getByRole("alert")).toContainText("xuất");
  await expect(page.getByRole("heading", { name: "Buổi bơi đã lưu" })).toHaveCount(0);
});

test("a tournament member sees Verified, then Duplicate for the same file", async ({
  page,
}, testInfo) => {
  const label = `member-${testInfo.project.name}`;
  await signUp(page, label);
  const email = emails[emails.length - 1];
  const me = await prisma.user.findUniqueOrThrow({ where: { email } });
  const organizer = await prisma.user.create({
    data: {
      email: `upload-ui-org-${label}-${stamp}@example.com`,
      passwordHash: "x",
      displayName: "Org",
    },
  });
  emails.push(organizer.email);
  const tournament = await prisma.tournament.create({
    data: {
      organizerId: organizer.id,
      name: `Giải upload ${label} ${stamp}`,
      description: "d",
      status: "ACTIVE",
      seasonStartAt: new Date("2026-01-01T00:00:00+07:00"),
      seasonEndAt: new Date("2099-01-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100000,
      fastestPaceSecPer100m: 30,
      // The fixture swim is dated 2026-06-01: keep its upload within the submission deadline.
      submissionDays: 36500,
    },
  });
  tournamentIds.push(tournament.id);
  const team = await prisma.team.create({
    data: { tournamentId: tournament.id, name: "Đội", emblemKey: "dolphin", memberLimit: 5 },
  });
  await prisma.teamMember.create({
    data: { tournamentId: tournament.id, teamId: team.id, userId: me.id, status: "ACTIVE" },
  });

  const upload = async () => {
    await page.goto("/connect");
    await page
      .getByLabel("Tải lên tệp GPX/FIT")
      .setInputFiles("src/server/swims/parse/__tests__/fixtures/open-water.gpx");
    await page.getByRole("button", { name: "Tải lên", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Buổi bơi đã lưu" })).toBeVisible();
    await expect(page.getByText(tournament.name)).toBeVisible();
  };
  await upload();
  await expect(page.getByText("Đã xác nhận")).toBeVisible();
  await upload();
  await expect(page.getByText("Trùng lặp")).toBeVisible();
});
