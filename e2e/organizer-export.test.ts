import { readFile } from "node:fs/promises";
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
  const ids = users.map((u) => u.id);
  const tournaments = { organizerId: { in: ids } };
  await prisma.teamMember.deleteMany({ where: { team: { tournament: tournaments } } });
  await prisma.team.deleteMany({ where: { tournament: tournaments } });
  await prisma.tournament.deleteMany({ where: tournaments });
  await prisma.session.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

test("the organizer downloads a CSV with team, name, km and points and no emails", async ({
  page,
}, testInfo) => {
  const p = testInfo.project.name;
  const email = `organizer-export-${p}-${stamp}@example.com`;
  emails.push(email);
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByLabel("Tên hiển thị").fill("Lan");
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  const created = await page.request.post("/api/tournaments", {
    data: {
      name: `Giải Xuất ${p} ${stamp}`,
      description: "Xuất dữ liệu",
      seasonStart: { date: "2030-01-01", time: "00:00" },
      seasonEnd: { date: "2030-12-31", time: "23:59" },
      routeId: "route01",
      routeDistanceKm: "60",
    },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  const team = await page.request.post(`/api/tournaments/${id}/teams`, {
    data: { name: "Cá Heo", emblemKey: "turtle", memberLimit: 5 },
  });
  expect(team.status()).toBe(201);

  await page.goto(`/tournaments/${id}/manage`);
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Xuất tệp" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.csv$/);
  const text = (await readFile((await file.path()) as string, "utf8")).replace(/^﻿/, "");
  const [header, ...rows] = text.trim().split(/\r?\n/);
  expect(header).toMatch(/Đội \/ Team/);
  expect(header).toMatch(/Tên hiển thị \/ Name/);
  expect(header).toMatch(/Verified km/);
  expect(header).toMatch(/Points/);
  expect(rows.some((row) => row.startsWith("Cá Heo,"))).toBe(true);
  expect(text).not.toContain("@");
});
