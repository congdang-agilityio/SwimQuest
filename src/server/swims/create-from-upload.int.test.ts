import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { buildFit } from "./parse/__tests__/fit-builder";
import { ParseError } from "./parse/types";
import { createSwimFromUpload, MAX_UPLOAD_BYTES, UploadError } from "./create-from-upload";
import { toOwnerSwimDto } from "./swim-dto";

const fixture = (n: string) => readFileSync(join(__dirname, "parse/__tests__/fixtures", n));
const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const user = (n: string) =>
  db.user.create({ data: { email: `${n}@example.com`, passwordHash: "h", displayName: n } });

async function clean() {
  await db.swim.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}

describe("createSwimFromUpload", () => {
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("stores a GPX swim with its track for the calling user only", async () => {
    const me = await user("me");
    const other = await user("other");
    const buffer = fixture("open-water.gpx");
    const swim = await createSwimFromUpload(me.id, { buffer, filename: "dir/../Morning.gpx" });

    const stored = await db.swim.findUniqueOrThrow({ where: { id: swim.id } });
    expect(stored.userId).toBe(me.id);
    expect(stored.source).toBe("GPX");
    expect(stored.fileSha256).toBe(sha256(buffer));
    expect(stored.originalFilename).toBe("Morning.gpx");
    expect(stored.durationS).toBe(150);
    expect(stored.swimType).toBe("OPEN_WATER");
    expect(stored.duplicateOfId).toBeNull();
    expect(stored.track).toEqual([
      { lat: 10, lon: 106, time: "2026-06-01T07:00:00.000Z" },
      { lat: 10.001, lon: 106, time: "2026-06-01T07:01:00.000Z" },
      { lat: 10.002, lon: 106, time: "2026-06-01T07:02:30.000Z" },
    ]);
    expect(await db.swim.count({ where: { userId: other.id } })).toBe(0);
  });

  it("stores a FIT swim whatever the file name says", async () => {
    const me = await user("me");
    const buffer = buildFit({
      sport: 5,
      subSport: 17,
      start: new Date("2026-06-03T06:30:00Z"),
      timerS: 600,
      distanceM: 400,
    });
    const swim = await createSwimFromUpload(me.id, { buffer, filename: "swim.gpx" });

    const stored = await db.swim.findUniqueOrThrow({ where: { id: swim.id } });
    expect(stored).toMatchObject({ userId: me.id, source: "FIT", distanceM: 400, durationS: 600 });
    expect(stored.swimType).toBe("POOL");
    expect(stored.fileSha256).toBe(sha256(buffer));
    expect(stored.track).toBeNull();
  });

  it.each([
    ["an unreadable GPX", () => fixture("malformed.gpx"), "UNREADABLE_FILE"],
    ["a file that is not GPX or FIT", () => Buffer.from("hello"), "UNSUPPORTED_FILE"],
    ["a pool GPX without distance", () => fixture("pool-no-distance.gpx"), "NO_DISTANCE"],
  ])("saves nothing for %s and keeps the parse code", async (_c, file, code) => {
    const me = await user("me");
    const err = await createSwimFromUpload(me.id, { buffer: file(), filename: "x.gpx" }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ParseError);
    expect((err as ParseError).code).toBe(code);
    expect(await db.swim.count()).toBe(0);
  });

  it("rejects a file over 10 MB before parsing and saves nothing", async () => {
    const me = await user("me");
    expect(MAX_UPLOAD_BYTES).toBe(10 * 1024 * 1024);
    const buffer = Buffer.alloc(MAX_UPLOAD_BYTES + 1);
    const err = await createSwimFromUpload(me.id, { buffer, filename: "big.fit" }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(UploadError);
    expect((err as UploadError).code).toBe("FILE_TOO_LARGE");
    expect(await db.swim.count()).toBe(0);
  });

  it("rejects input that is not a buffer or has no owner", async () => {
    const me = await user("me");
    const bad = [
      () => createSwimFromUpload("", { buffer: fixture("open-water.gpx"), filename: "a.gpx" }),
      () =>
        createSwimFromUpload(me.id, { buffer: "<gpx>" as unknown as Buffer, filename: "a.gpx" }),
    ];
    for (const call of bad) await expect(call()).rejects.toThrow();
    expect(await db.swim.count()).toBe(0);
  });

  it("returns a DTO without the track for the stored swim", async () => {
    const me = await user("me");
    const swim = await createSwimFromUpload(me.id, {
      buffer: fixture("open-water.gpx"),
      filename: "a.gpx",
    });
    const dto = toOwnerSwimDto(swim);
    expect(dto).not.toHaveProperty("track");
    expect(dto).not.toHaveProperty("fileSha256");
    expect(dto.id).toBe(swim.id);
  });
});
