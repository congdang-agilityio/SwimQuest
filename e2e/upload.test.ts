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
  const userId = { in: users.map((u) => u.id) };
  // Points entries reference swim results, so they go first.
  await prisma.pointsEntry.deleteMany({ where: { userId } });
  await prisma.swimResult.deleteMany({ where: { userId } });
  await prisma.swim.deleteMany({ where: { userId } });
  await prisma.session.deleteMany({ where: { userId } });
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
