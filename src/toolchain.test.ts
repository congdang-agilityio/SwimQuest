import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));

function readJson(name: string) {
  return JSON.parse(readFileSync(`${root}/${name}`, "utf8"));
}

describe("Prisma toolchain", () => {
  const pkg = readJson("package.json");
  const lock = readJson("package-lock.json");

  it("declares the Prisma CLI and client with the same stable range", () => {
    const cli: string = pkg.devDependencies.prisma;
    const client: string = pkg.dependencies["@prisma/client"];
    expect(cli).toBe(client);
    expect(cli).not.toMatch(/-/);
  });

  it("locks the Prisma CLI and client to the same version", () => {
    const cli: string = lock.packages["node_modules/prisma"].version;
    const client: string = lock.packages["node_modules/@prisma/client"].version;
    expect(cli).toBe(client);
    expect(cli).not.toMatch(/-/);
  });
});
