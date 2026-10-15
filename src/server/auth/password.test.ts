import { describe, expect, it } from "vitest";
import {
  ARGON2_MEMORY_COST_KIB,
  ARGON2_PARALLELISM,
  ARGON2_TIME_COST,
  hashPassword,
  verifyPassword,
} from "./password";

describe("password hashing", () => {
  it("hashes with argon2id and never returns the plain password", async () => {
    const hash = await hashPassword("correct horse");

    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain("correct horse");
  });

  it("pins the argon2id cost parameters in the hash", async () => {
    const hash = await hashPassword("correct horse");

    const params = Object.fromEntries(
      hash
        .split("$")[3]
        .split(",")
        .map((pair) => pair.split("=")),
    );
    expect(params).toEqual({
      m: String(ARGON2_MEMORY_COST_KIB),
      t: String(ARGON2_TIME_COST),
      p: String(ARGON2_PARALLELISM),
    });
    expect([ARGON2_MEMORY_COST_KIB, ARGON2_TIME_COST, ARGON2_PARALLELISM]).toEqual([65536, 3, 4]);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same password")).not.toBe(await hashPassword("same password"));
  });

  it("verifies the right password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct horse");

    await expect(verifyPassword(hash, "correct horse")).resolves.toBe(true);
    await expect(verifyPassword(hash, "wrong horse")).resolves.toBe(false);
  });

  it("returns false for a malformed hash instead of throwing", async () => {
    await expect(verifyPassword("not-a-hash", "anything")).resolves.toBe(false);
  });
});
