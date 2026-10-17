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
  await prisma.badge.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
  await prisma.teamMember.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
  await prisma.team.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
  await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

// AC 4 "Missing art falls back": every request under /art/ and /brand/ answers 404, and the pages
// that use art keep working. Each missing image is replaced by its fallback (never a broken image).
test("with all art missing, Voyage, My Team, Profile and Home render with fallbacks", async ({
  page,
}, testInfo) => {
  const label = `missingart-${testInfo.project.name}`;
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
      name: `Giải ${label} ${stamp}`,
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
  await prisma.badge.create({
    data: { tournamentId: tournament.id, userId: me.id, teamId: team.id, kind: "PARTICIPATION" },
  });

  const missing: string[] = [];
  await page.route(/^https?:\/\/[^/]+\/(art|brand)\//, (route) => {
    missing.push(new URL(route.request().url()).pathname);
    return route.fulfill({ status: 404, body: "not found" });
  });

  const pages: [string, () => ReturnType<typeof page.locator>][] = [
    ["/voyage", () => page.getByTestId("route-map")],
    ["/team", () => page.getByRole("heading", { name: "Đội" })],
    ["/profile", () => page.getByRole("heading", { level: 1 })],
    ["/", () => page.getByRole("heading", { name: "SwimQuest" })],
  ];
  for (const [path, ready] of pages) {
    await page.goto(path);
    await expect(ready().first(), `${path} renders`).toBeVisible();
    // No error boundary.
    await expect(page.getByText("Đã xảy ra lỗi"), `${path} has no error boundary`).toHaveCount(0);
    // Every image that asked for missing art is gone (its fallback shows), none stays broken.
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              [...document.querySelectorAll("img")].filter(
                (i) => /\/(art|brand)\//.test(i.getAttribute("src") ?? "") || i.naturalWidth === 0,
              ).length,
          ),
        { message: `${path} shows no broken image`, timeout: 10_000 },
      )
      .toBe(0);
  }
  expect(missing.length, "the pages did ask for art").toBeGreaterThan(0);
});
