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

test.afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  const userId = { in: users.map((u) => u.id) };
  await prisma.xpEntry.deleteMany({ where: { userId } });
  await prisma.pointsEntry.deleteMany({ where: { userId } });
  await prisma.swimResult.deleteMany({ where: { userId } });
  await prisma.swim.deleteMany({ where: { userId } });
  await prisma.teamMember.deleteMany({ where: { userId } });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

const gpx = (day: string) => `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><time>${day}T07:00:00Z</time></metadata>
  <trk><type>open_water_swimming</type><trkseg>
    <trkpt lat="10.0000" lon="106.0000"><time>${day}T07:00:00Z</time></trkpt>
    <trkpt lat="10.0010" lon="106.0000"><time>${day}T07:01:00Z</time></trkpt>
    <trkpt lat="10.0020" lon="106.0000"><time>${day}T07:02:30Z</time></trkpt>
  </trkseg></trk>
</gpx>`;

test("two uploaded swims are listed newest first from the Profile tab", async ({
  page,
}, testInfo) => {
  const email = `my-swims-${testInfo.project.name}-${stamp}@example.com`;
  emails.push(email);
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByLabel("Tên hiển thị").fill("Lan");
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  for (const day of ["2026-05-01", "2026-06-01"]) {
    await page.goto("/connect");
    await page.getByLabel("Tải lên tệp GPX/FIT").setInputFiles({
      name: `${day}.gpx`,
      mimeType: "application/gpx+xml",
      buffer: Buffer.from(gpx(day)),
    });
    await page.getByRole("button", { name: "Tải lên", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Buổi bơi đã lưu" })).toBeVisible();
  }

  await page.goto("/profile");
  await page.getByRole("link", { name: "Các lần bơi của tôi" }).click();
  await page.waitForURL((url) => url.pathname === "/swims");
  const rows = page.locator("main li");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("01/06/2026");
  await expect(rows.nth(1)).toContainText("01/05/2026");
  await expect(rows.nth(0).getByRole("link")).toHaveAttribute("href", /^\/swims\/.+/);
});

test("a swim opens with status and points per tournament; another user gets not-found", async ({
  page,
  browser,
}, testInfo) => {
  const email = `my-swim-detail-${testInfo.project.name}-${stamp}@example.com`;
  emails.push(email);
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByLabel("Tên hiển thị").fill("Lan");
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  await page.goto("/connect");
  await page.getByLabel("Tải lên tệp GPX/FIT").setInputFiles({
    name: "detail.gpx",
    mimeType: "application/gpx+xml",
    buffer: Buffer.from(gpx("2026-07-01")),
  });
  await page.getByRole("button", { name: "Tải lên", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Buổi bơi đã lưu" })).toBeVisible();
  await page.getByRole("link", { name: "Mở buổi bơi" }).click();
  await page.waitForURL((url) => /^\/swims\/.+/.test(url.pathname));
  const detailUrl = page.url();
  await expect(page.getByRole("heading", { name: "Chi tiết buổi bơi" })).toBeVisible();
  await expect(page.getByText("01/07/2026")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kết quả theo giải đấu" })).toBeVisible();

  const other = await browser.newContext();
  const op = await other.newPage();
  const email2 = `my-swim-detail2-${testInfo.project.name}-${stamp}@example.com`;
  emails.push(email2);
  await op.goto("/signup");
  await op.getByLabel("Email").fill(email2);
  await op.getByLabel("Mật khẩu").fill(PASSWORD);
  await op.getByLabel("Tên hiển thị").fill("Minh");
  await op.getByRole("button", { name: "Đăng ký" }).click();
  await op.waitForURL((url) => url.pathname === "/");
  const res = await op.goto(detailUrl);
  expect(res?.status()).toBe(404);
  await other.close();
});
