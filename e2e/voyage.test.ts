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
  await prisma.teamMember.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
  await prisma.team.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
  await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

test("a verified swim moves the label and the ship after a refresh", async ({ page }, testInfo) => {
  const label = `voyage-${testInfo.project.name}`;
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
      name: `Giải hành trình ${label} ${stamp}`,
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

  await page.goto("/voyage");
  await expect(page.getByTestId("progress-label")).toHaveText("0 / 100 km hành trình · 0%");
  await expect(page.getByTestId("ship")).toBeVisible();
  await expectLabelReadable(page);
  await expect(page.getByTestId("route-path")).toBeAttached();
  await expect(page.getByTestId("destination-ly_son")).toContainText("Lý Sơn");
  await expect(page.getByText(/không phải hải đồ/)).toBeVisible();
  const before = await page.getByTestId("ship").boundingBox();

  await page.goto("/connect");
  await page
    .getByLabel("Tải lên tệp GPX/FIT")
    .setInputFiles("src/server/swims/parse/__tests__/fixtures/open-water.gpx");
  await page.getByRole("button", { name: "Tải lên", exact: true }).click();
  await expect(page.getByText("Đã xác nhận")).toBeVisible();

  await page.goto("/voyage");
  await expect(page.getByTestId("progress-label")).not.toHaveText("0 / 100 km hành trình · 0%");
  await expect(page.getByTestId("progress-label")).toContainText("/ 100 km hành trình");
  const after = await page.getByTestId("ship").boundingBox();
  expect(after).not.toEqual(before);
});

test("a team without a start sees the notice, no path and no ship", async ({ page }, testInfo) => {
  const label = `voyage-nostart-${testInfo.project.name}`;
  const email = `${label}-${stamp}@example.com`;
  emails.push(email, `${label}-org-${stamp}@example.com`);
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByLabel("Tên hiển thị").fill("Lan");
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  const me = await prisma.user.findUniqueOrThrow({ where: { email } });
  const organizer = await prisma.user.create({
    data: { email: `${label}-org-${stamp}@example.com`, passwordHash: "x", displayName: "Org" },
  });
  const tournament = await prisma.tournament.create({
    data: {
      organizerId: organizer.id,
      name: `Giải ${label} ${stamp}`,
      description: "d",
      status: "PUBLISHED",
      seasonStartAt: new Date("2098-01-01T00:00:00+07:00"),
      seasonEndAt: new Date("2099-01-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100000,
    },
  });
  tournamentIds.push(tournament.id);
  const team = await prisma.team.create({
    data: { tournamentId: tournament.id, name: "Đội", emblemKey: "dolphin", memberLimit: 5 },
  });
  await prisma.teamMember.create({
    data: { tournamentId: tournament.id, teamId: team.id, userId: me.id, status: "ACTIVE" },
  });
  await page.goto("/voyage");
  await expect(page.getByTestId("no-start")).toHaveText("Chưa chọn điểm xuất phát");
  await expect(page.getByTestId("ship")).toHaveCount(0);
  await expect(page.getByTestId("route-path")).toHaveCount(0);
});

type Box = { x: number; y: number; width: number; height: number };
const intersects = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/**
 * The progress label is a whole, readable caption directly under the map at every width (#619),
 * the ship stays on the map, and the label covers no destination name.
 */
async function expectLabelReadable(page: Page) {
  const map = (await page.getByTestId("route-map").boundingBox()) as Box;
  const labelEl = page.getByTestId("progress-label");
  const label = (await labelEl.boundingBox()) as Box;
  if (!map || !label) throw new Error("map or label not rendered");
  expect(label.x).toBeGreaterThanOrEqual(map.x - 0.5);
  expect(label.x + label.width).toBeLessThanOrEqual(map.x + map.width + 0.5);
  expect(label.y, "caption directly under the map").toBeGreaterThanOrEqual(
    map.y + map.height - 0.5,
  );
  expect(label.y).toBeLessThanOrEqual(map.y + map.height + 16);
  const fits = await labelEl.evaluate((el) => el.scrollWidth <= el.clientWidth);
  expect(fits, "label text not cut off").toBe(true);
  const ship = (await page.getByTestId("ship").boundingBox()) as Box;
  expect(ship.x).toBeGreaterThanOrEqual(map.x - 0.5);
  expect(ship.y).toBeGreaterThanOrEqual(map.y - 0.5);
  expect(ship.x + ship.width).toBeLessThanOrEqual(map.x + map.width + 0.5);
  expect(ship.y + ship.height).toBeLessThanOrEqual(map.y + map.height + 0.5);
  const names = page.getByTestId("landmark-name");
  await expect(names).toHaveCount(7); // route01 has 7 destinations
  for (const name of await names.all()) {
    const box = (await name.boundingBox()) as Box;
    expect(intersects(label, box), `label covers ${await name.textContent()}`).toBe(false);
  }
}

async function seedTeamOnMap(page: Page, label: string, { start = "hon_sup", points = 1500 } = {}) {
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
      startDestination: start,
      startSetBy: "CAPTAIN",
      startSetAt: new Date(),
    },
  });
  await prisma.teamMember.create({
    data: { tournamentId: tournament.id, teamId: team.id, userId: me.id, status: "ACTIVE" },
  });
  if (points === 0) return;
  // 1500 points on a 100 km route at 10 points/km is above the route length.
  await prisma.pointsEntry.create({
    data: {
      tournamentId: tournament.id,
      userId: me.id,
      teamId: team.id,
      kind: "DISTANCE",
      points,
      countedM: points * 100,
      vnDay: "2026-02-01",
    },
  });
}

function labelAtFinishTests() {
  test("at 100% the label is whole and clear of every destination name", async ({
    page,
  }, testInfo) => {
    await seedTeamOnMap(
      page,
      `voyage-finish-${testInfo.project.name}-${testInfo.parallelIndex}-${testInfo.workerIndex}-${testInfo.retry}-${Date.now()}`,
    );
    await page.goto("/voyage");
    await expect(page.getByTestId("progress-label")).toHaveText("100 / 100 km hành trình · 100%");
    await expectLabelReadable(page);
  });
}

test.describe("progress label at the finish", () => {
  labelAtFinishTests();
});

test.describe("progress label at the finish on a 320 px phone", () => {
  test.use({ viewport: { width: 320, height: 568 } });
  labelAtFinishTests();
});

// Non Nước sits near the top of the map (y = 8%), so a label above the ship would be cut off.
function labelAtNonNuocStartTests() {
  test("at 0% from Non Nước the label is whole and clear of every destination name", async ({
    page,
  }, testInfo) => {
    await seedTeamOnMap(page, `voyage-non-nuoc-${testInfo.project.name}-${Date.now()}`, {
      start: "non_nuoc",
      points: 0,
    });
    await page.goto("/voyage");
    await expect(page.getByTestId("progress-label")).toHaveText("0 / 100 km hành trình · 0%");
    await expectLabelReadable(page);
  });
}

test.describe("progress label at the finish on a 768 px viewport", () => {
  test.use({ viewport: { width: 768, height: 1024 } });
  labelAtFinishTests();
});

test.describe("progress label at the finish in English on a 320 px phone", () => {
  test.use({ viewport: { width: 320, height: 568 } });
  test("the full English label is visible", async ({ page }, testInfo) => {
    await seedTeamOnMap(page, `voyage-finish-en-${testInfo.project.name}-${Date.now()}`);
    await page.context().addCookies([{ name: "NEXT_LOCALE", value: "en", url: page.url() }]);
    await page.goto("/voyage");
    await expect(page.getByTestId("progress-label")).toHaveText("100 / 100 route km · 100%");
    await expectLabelReadable(page);
  });
});

for (const width of [1024, 1280, 1920]) {
  test.describe(`progress label on a ${width} px desktop`, () => {
    test.use({ viewport: { width, height: 1080 } });
    labelAtFinishTests();
    labelAtNonNuocStartTests();
  });
}

// The cases that used to put the label over a name: Bãi Mân Thái and Cù Lao Chàm (#619).
for (const [name, start, points, text] of [
  ["30% from Sơn Thủy", "son_thuy", 300, "30 / 100 km hành trình · 30%"],
  ["80% from Hòn Sụp", "hon_sup", 800, "80 / 100 km hành trình · 80%"],
] as const) {
  test.describe(`progress label at ${name} on a 1280 px desktop`, () => {
    test.use({ viewport: { width: 1280, height: 1080 } });
    test("is a caption and covers no destination name", async ({ page }, testInfo) => {
      await seedTeamOnMap(page, `voyage-${start}-${testInfo.project.name}-${Date.now()}`, {
        start,
        points,
      });
      await page.goto("/voyage");
      await expect(page.getByTestId("progress-label")).toHaveText(text);
      await expectLabelReadable(page);
    });
  });
}

test.describe("progress label at 0% from Non Nước", () => {
  labelAtNonNuocStartTests();
});

test.describe("progress label at 0% from Non Nước on a 320 px phone", () => {
  test.use({ viewport: { width: 320, height: 568 } });
  labelAtNonNuocStartTests();
});

test.describe("progress label at 0% from Non Nước on a 768 px viewport", () => {
  test.use({ viewport: { width: 768, height: 1024 } });
  labelAtNonNuocStartTests();
});

async function expectNamesReadable(page: Page) {
  const map = (await page.getByTestId("route-map").boundingBox()) as Box;
  // Every rendered destination is checked, so a new or missed one cannot hide an overlap.
  const dests = page.locator('[data-testid^="destination-"]');
  await expect(dests).toHaveCount(7); // route01 has 7 destinations
  const slugs: string[] = [];
  const names: Box[] = [];
  const icons: Box[] = [];
  for (const dest of await dests.all()) {
    const slug = (await dest.getAttribute("data-testid"))!.replace("destination-", "");
    const name = (await dest.getByTestId("landmark-name").boundingBox()) as Box;
    expect(name, `${slug} name`).not.toBeNull();
    expect(name.x, `${slug} left`).toBeGreaterThanOrEqual(map.x);
    expect(name.y, `${slug} top`).toBeGreaterThanOrEqual(map.y);
    expect(name.x + name.width, `${slug} right`).toBeLessThanOrEqual(map.x + map.width);
    expect(name.y + name.height, `${slug} bottom`).toBeLessThanOrEqual(map.y + map.height);
    slugs.push(slug);
    names.push(name);
    const icon = await dest.locator("img").first().boundingBox();
    if (icon) icons.push(icon);
  }
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      expect(intersects(names[i], names[j]), `${slugs[i]}/${slugs[j]}`).toBe(false);
    }
    for (const icon of icons) expect(intersects(names[i], icon), slugs[i]).toBe(false);
  }
}

test.describe("destination names stay readable", () => {
  test("on the project viewport", async ({ page }, testInfo) => {
    await seedTeamOnMap(page, `names-${testInfo.project.name}-${Date.now()}`, {
      start: "non_nuoc",
      points: 0,
    });
    await page.goto("/voyage");
    await expectNamesReadable(page);
  });
});

test.describe("destination names stay readable at 320 px", () => {
  test.use({ viewport: { width: 320, height: 568 } });
  test("no overlap on a 320 px viewport", async ({ page }, testInfo) => {
    await seedTeamOnMap(page, `names320-${testInfo.project.name}-${Date.now()}`, {
      start: "non_nuoc",
      points: 0,
    });
    await page.goto("/voyage");
    await expectNamesReadable(page);
  });
});
