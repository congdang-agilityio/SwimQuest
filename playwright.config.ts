import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const port = Number(process.env.PORT ?? 3000);

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.test.ts",
  reporter: process.env.CI ? "html" : "list",
  // The service worker would hide its requests from page.route(); offline specs opt back in.
  use: { baseURL: `http://localhost:${port}`, serviceWorkers: "block" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run build && npm start",
    url: `http://localhost:${port}/api/health`,
    env: { PORT: String(port), APP_URL: `http://localhost:${port}` },
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
