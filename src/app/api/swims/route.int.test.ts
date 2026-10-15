import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { MAX_UPLOAD_BYTES } from "@/server/swims/create-from-upload";
import { buildFit } from "@/server/swims/parse/__tests__/fit-builder";

const jar = vi.hoisted(() => ({ token: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "sq_session" && jar.token !== undefined ? { name, value: jar.token } : undefined,
  }),
}));

const { POST } = await import("./route");

const fixtures = join(__dirname, "../../../server/swims/parse/__tests__/fixtures");
const fixture = (n: string) => readFileSync(join(fixtures, n));

function upload(file?: Buffer, name = "swim.gpx", extra: Record<string, string> = {}) {
  const form = new FormData();
  if (file) form.set("file", new File([new Uint8Array(file)], name));
  for (const [k, v] of Object.entries(extra)) form.set(k, v);
  return new Request("http://localhost/api/swims", { method: "POST", body: form });
}

const user = (n: string) =>
  db.user.create({ data: { email: `${n}@example.com`, passwordHash: "h", displayName: n } });
async function signIn(n: string) {
  const u = await user(n);
  jar.token = (await createSession(u.id)).token;
  return u;
}
async function clean() {
  await db.swim.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}
const codeOf = async (res: Response) => ((await res.json()) as { error: { code: string } }).error;

describe("POST /api/swims", () => {
  beforeEach(async () => {
    jar.token = undefined;
    await clean();
  });
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("stores a GPX swim for the session user and returns 201 with the owner DTO", async () => {
    const me = await signIn("me");
    const res = await POST(upload(fixture("open-water.gpx")));
    expect(res.status).toBe(201);
    const { swim } = await res.json();
    expect(swim).toMatchObject({ source: "GPX", swimType: "OPEN_WATER", durationS: 150 });
    expect(swim).not.toHaveProperty("track");
    expect(swim).not.toHaveProperty("userId");
    const stored = await db.swim.findUniqueOrThrow({ where: { id: swim.id } });
    expect(stored.userId).toBe(me.id);
  });

  it("stores a FIT swim (201)", async () => {
    await signIn("me");
    const fit = buildFit({
      sport: 5,
      subSport: 17,
      start: new Date("2026-06-03T06:30:00Z"),
      timerS: 600,
      distanceM: 400,
    });
    const res = await POST(upload(fit, "swim.fit"));
    expect(res.status).toBe(201);
    expect((await res.json()).swim).toMatchObject({ source: "FIT", distanceM: 400 });
  });

  it("ignores a userId field in the form: the owner is the session user", async () => {
    const me = await signIn("me");
    const other = await user("other");
    const res = await POST(
      upload(fixture("open-water.gpx"), "a.gpx", { userId: other.id, user_id: other.id }),
    );
    expect(res.status).toBe(201);
    expect(await db.swim.count({ where: { userId: other.id } })).toBe(0);
    expect(await db.swim.count({ where: { userId: me.id } })).toBe(1);
  });

  it.each([
    ["UNREADABLE_FILE", () => fixture("malformed.gpx")],
    ["UNSUPPORTED_FILE", () => Buffer.from("hello")],
    ["NO_DISTANCE", () => fixture("pool-no-distance.gpx")],
  ])("returns 400 %s and saves nothing", async (code, file) => {
    await signIn("me");
    const res = await POST(upload(file()));
    expect(res.status).toBe(400);
    expect((await codeOf(res)).code).toBe(code);
    expect(await db.swim.count()).toBe(0);
  });

  it("returns 400 FILE_REQUIRED without a file field or a multipart body", async () => {
    await signIn("me");
    const noFile = await POST(upload(undefined, "x", { file: "text, not a file" }));
    expect(noFile.status).toBe(400);
    expect((await codeOf(noFile)).code).toBe("FILE_REQUIRED");
    const json = await POST(
      new Request("http://localhost/api/swims", { method: "POST", body: "{}" }),
    );
    expect(json.status).toBe(400);
    expect((await codeOf(json)).code).toBe("FILE_REQUIRED");
  });

  it("returns 400 FILE_TOO_LARGE for a file over 10 MB", async () => {
    await signIn("me");
    const res = await POST(upload(Buffer.alloc(MAX_UPLOAD_BYTES + 1), "big.fit"));
    expect(res.status).toBe(400);
    expect((await codeOf(res)).code).toBe("FILE_TOO_LARGE");
    expect(await db.swim.count()).toBe(0);
  });

  it("rejects a declared Content-Length over the cap without reading the body", async () => {
    await signIn("me");
    let pulled = 0;
    const body = new ReadableStream({
      pull(c) {
        pulled++;
        c.enqueue(new Uint8Array(1024));
      },
    });
    const res = await POST(
      new Request("http://localhost/api/swims", {
        method: "POST",
        body,
        duplex: "half",
        headers: {
          "content-type": "multipart/form-data; boundary=x",
          "content-length": String(MAX_UPLOAD_BYTES * 2),
        },
      } as RequestInit),
    );
    expect(res.status).toBe(400);
    expect((await codeOf(res)).code).toBe("FILE_TOO_LARGE");
    expect(pulled).toBeLessThanOrEqual(1);
  });

  it("stops reading a body without Content-Length once it passes the cap", async () => {
    await signIn("me");
    let sent = 0;
    const body = new ReadableStream({
      pull(c) {
        sent += 1024 * 1024;
        c.enqueue(new Uint8Array(1024 * 1024));
      },
    });
    const res = await POST(
      new Request("http://localhost/api/swims", {
        method: "POST",
        body,
        duplex: "half",
        headers: { "content-type": "multipart/form-data; boundary=x" },
      } as RequestInit),
    );
    expect(res.status).toBe(400);
    expect((await codeOf(res)).code).toBe("FILE_TOO_LARGE");
    expect(sent).toBeLessThan(MAX_UPLOAD_BYTES + 4 * 1024 * 1024);
  });

  it("returns 401 when signed out and saves nothing", async () => {
    const res = await POST(upload(fixture("open-water.gpx")));
    expect(res.status).toBe(401);
    expect(await db.swim.count()).toBe(0);
  });

  it("returns 403 FORBIDDEN_ORIGIN for a cross-site request", async () => {
    await signIn("me");
    const req = upload(fixture("open-water.gpx"));
    req.headers.set("origin", "http://evil.example");
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(await db.swim.count()).toBe(0);
  });
});
