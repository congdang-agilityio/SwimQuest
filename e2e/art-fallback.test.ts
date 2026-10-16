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
  await prisma.teamMember.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
  await prisma.team.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
  await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

const failures = {
  "404 at once": (route: import("@playwright/test").Route) =>
    route.fulfill({ status: 404, body: "nf" }),
  "aborted network request": (route: import("@playwright/test").Route) => route.abort(),
};

for (const [name, fail] of Object.entries(failures)) {
  test(`art that fails at once (${name}) shows the fallbacks`, async ({ page }, testInfo) => {
    const label = `artfb-${name.split(" ")[0]}-${testInfo.project.name}`;
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

    // Registered before goto so the failure can arrive before React hydrates.
    await page.route("**/art/**", fail);
    await page.goto("/voyage");

    await expect(page.getByTestId("progress-label")).toBeVisible();
    const map = page.getByTestId("route-map");
    await expect(map).toBeVisible();
    await expect(page.getByTestId("ship").getByRole("img")).toBeVisible();
    const dots = map.locator('[data-testid^="destination-"] span[aria-hidden="true"]');
    await expect(dots).toHaveCount(7);
    await expect(map.locator("img")).toHaveCount(0);
    const broken = await page.evaluate(
      () => [...document.querySelectorAll("img")].filter((i) => i.naturalWidth === 0).length,
    );
    expect(broken).toBe(0);
  });
}
