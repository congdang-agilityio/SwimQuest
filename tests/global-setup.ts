import { execFileSync } from "node:child_process";

/**
 * Brings the test database up to the latest migrations before the run. Integration tests
 * clean their own rows, so only databases whose name contains "test" are accepted.
 */
export default function setup() {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  const name = new URL(url).pathname.slice(1);
  if (!name.includes("test")) {
    throw new Error(
      `Refusing to run tests against database "${name}": its name must contain "test".`,
    );
  }
  execFileSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", env: process.env });
}
