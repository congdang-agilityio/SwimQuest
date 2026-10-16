import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { MAX_IMAGE_BYTES } from "@/server/images/store";

const jar = vi.hoisted(() => ({ token: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "sq_session" && jar.token !== undefined ? { name, value: jar.token } : undefined,
  }),
}));

const { POST } = await import("./route");
const { GET } = await import("./[id]/route");

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** A PNG-signed buffer of `size` bytes (the service only checks the signature). */
const png = (size = 64) => {
  const b = Buffer.alloc(size, 7);
  Buffer.from(PNG_SIG).copy(b);
  return b;
};
const jpeg = () => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]);

function upload(
  file: Buffer | undefined,
  { name = "photo.png", type = "image/png", kind = "AVATAR" as string | null } = {},
) {
  const form = new FormData();
  if (file) form.set("file", new File([new Uint8Array(file)], name, { type }));
  if (kind !== null) form.set("kind", kind);
  return new Request("http://localhost/api/images", { method: "POST", body: form });
}
const get = (id: string) =>
  GET(new Request(`http://localhost/api/images/${id}`), { params: Promise.resolve({ id }) });

async function signIn(n: string) {
  const u = await db.user.create({
    data: { email: `${n}@example.com`, passwordHash: "h", displayName: n },
  });
  jar.token = (await createSession(u.id)).token;
  return u;
}
async function clean() {
  await db.imageAsset.deleteMany();
  await db.session.deleteMany();
  await db.xpEntry.deleteMany();
  await db.user.deleteMany();
}
const errorOf = async (res: Response) =>
  ((await res.json()) as { error: { code: string; fields?: Record<string, string> } }).error;

describe("POST /api/images and GET /api/images/:id", () => {
  beforeEach(async () => {
    jar.token = undefined;
    await clean();
  });
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("stores a PNG for the session user and serves it publicly with its type", async () => {
    const me = await signIn("me");
    const bytes = png(300);
    const res = await POST(upload(bytes, { kind: "COVER" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(Object.keys(body)).toEqual(["id"]);
    expect(body.id).toMatch(/^c[a-z0-9]{20,}$/);

    const stored = await db.imageAsset.findUniqueOrThrow({ where: { id: body.id } });
    expect(stored).toMatchObject({ ownerId: me.id, kind: "COVER", mime: "image/png" });
    expect(stored.sizeBytes).toBe(300);

    jar.token = undefined; // images are public by id
    const served = await get(body.id);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/png");
    expect(served.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(served.headers.get("x-content-type-options")).toBe("nosniff");
    expect(served.headers.get("content-security-policy")).toBe("default-src 'none'");
    expect(Buffer.from(await served.arrayBuffer()).equals(bytes)).toBe(true);
  });

  it("stores a JPEG under the detected type, ignoring the file name", async () => {
    await signIn("me");
    const res = await POST(upload(jpeg(), { name: "../../evil.svg", type: "image/jpeg" }));
    expect(res.status).toBe(201);
    const served = await get((await res.json()).id);
    expect(served.headers.get("content-type")).toBe("image/jpeg");
  });

  it("accepts an image exactly at the 2 MB cap", async () => {
    await signIn("me");
    const res = await POST(upload(png(MAX_IMAGE_BYTES)));
    expect(res.status).toBe(201);
  });

  it("refuses an image one byte over the 2 MB cap (inside the body cap) and stores nothing", async () => {
    await signIn("me");
    const res = await POST(upload(png(MAX_IMAGE_BYTES + 1)));
    expect(res.status).toBe(400);
    expect((await errorOf(res)).code).toBe("IMAGE_TOO_LARGE");
    expect(await db.imageAsset.count()).toBe(0);
  });

  it("refuses a 2.1 MB image with IMAGE_TOO_LARGE and stores nothing", async () => {
    await signIn("me");
    const res = await POST(upload(png(Math.ceil(2.1 * 1024 * 1024))));
    expect(res.status).toBe(400);
    expect((await errorOf(res)).code).toBe("IMAGE_TOO_LARGE");
    expect(await db.imageAsset.count()).toBe(0);
  });

  it("refuses a far larger body without reading it all", async () => {
    await signIn("me");
    const res = await POST(upload(png(5 * 1024 * 1024)));
    expect(res.status).toBe(400);
    expect((await errorOf(res)).code).toBe("IMAGE_TOO_LARGE");
  });

  it.each([
    ["a text file renamed .png", Buffer.from("just some text, not an image"), "a.png", "image/png"],
    ["a GIF", Buffer.from("GIF89a\x01\x00\x01\x00\x00\x00\x00;"), "a.gif", "image/gif"],
    [
      "an SVG",
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'),
      "a.svg",
      "image/svg+xml",
    ],
    ["an SVG claimed as PNG", Buffer.from("<svg></svg>"), "a.png", "image/png"],
    ["PNG bytes claimed as JPEG", png(), "a.jpg", "image/jpeg"],
  ])("refuses %s with IMAGE_TYPE_NOT_ALLOWED", async (_n, bytes, name, type) => {
    await signIn("me");
    const res = await POST(upload(bytes, { name, type }));
    expect(res.status).toBe(400);
    expect((await errorOf(res)).code).toBe("IMAGE_TYPE_NOT_ALLOWED");
    expect(await db.imageAsset.count()).toBe(0);
  });

  it("returns 401 UNAUTHENTICATED when signed out and stores nothing", async () => {
    const res = await POST(upload(png()));
    expect(res.status).toBe(401);
    expect((await errorOf(res)).code).toBe("UNAUTHENTICATED");
    expect(await db.imageAsset.count()).toBe(0);
  });

  it("returns 400 VALIDATION_FAILED for a missing or unknown kind, or a missing file", async () => {
    await signIn("me");
    const noKind = await POST(upload(png(), { kind: null }));
    expect(noKind.status).toBe(400);
    expect(await errorOf(noKind)).toMatchObject({
      code: "VALIDATION_FAILED",
      fields: { kind: "INVALID_KIND" },
    });
    const badKind = await POST(upload(png(), { kind: "BACKGROUND" }));
    expect((await errorOf(badKind)).fields).toEqual({ kind: "INVALID_KIND" });
    const noFile = await POST(upload(undefined));
    expect(await errorOf(noFile)).toMatchObject({
      code: "VALIDATION_FAILED",
      fields: { file: "FILE_REQUIRED" },
    });
    const notMultipart = await POST(
      new Request("http://localhost/api/images", { method: "POST", body: "{}" }),
    );
    expect(notMultipart.status).toBe(400);
    expect(await db.imageAsset.count()).toBe(0);
  });

  it("refuses a cross-site upload with 403", async () => {
    await signIn("me");
    const req = upload(png());
    const cross = new Request(req, { headers: { origin: "https://evil.example" } });
    const res = await POST(cross);
    expect(res.status).toBe(403);
  });

  it("returns 404 for an unknown or malformed id", async () => {
    for (const id of ["cknotarealid0000000000000", "../etc/passwd", "x".repeat(200)]) {
      const res = await get(id);
      expect(res.status).toBe(404);
      expect((await errorOf(res)).code).toBe("NOT_FOUND");
    }
  });
});
