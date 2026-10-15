import react from "@vitejs/plugin-react";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

if (!process.env.DATABASE_URL && existsSync(".env.local")) process.loadEnvFile(".env.local");

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };
const exclude = ["e2e/**", "node_modules/**"];

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    environment: "node",
    globalSetup: ["tests/global-setup.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: [...exclude, "src/**/*.int.test.ts"],
        },
      },
      {
        extends: true,
        test: { name: "int", include: ["src/**/*.int.test.ts"], exclude, fileParallelism: false },
      },
    ],
  },
});
