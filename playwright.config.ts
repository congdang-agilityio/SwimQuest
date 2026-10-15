import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Slot-specific PORT lives in .env.local (not loaded by Playwright); CI uses the default.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const port = Number(process.env.PORT ?? 3000);

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.test.ts",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // PORT is passed through env so `next start` binds the same port as baseURL.
    command: "npm run build && npm start",
    url: `http://localhost:${port}/api/health`,
    env: { PORT: String(port) },
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
