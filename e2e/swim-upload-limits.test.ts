import { request as httpRequest } from "node:http";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { db } from "@/server/db";

/**
 * Upload size limits of POST /api/swims through the real server, so the request also passes
 * through `src/middleware.ts` (which buffers bodies up to `middlewareClientMaxBodySize`).
 * The route-level integration tests call the handler directly and cannot see that layer.
 */

const MB = 1024 * 1024;
const MAX_UPLOAD_BYTES = 10 * MB; // same as MAX_UPLOAD_BYTES in server/swims/create-from-upload.ts

const GPX_HEAD = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="e2e" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><time>2026-06-01T07:00:00Z</time></metadata>
  <trk>
    <name>Morning swim</name>
    <type>open_water_swimming</type>
    <trkseg>
      <trkpt lat="10.0000" lon="106.0000"><time>2026-06-01T07:00:00Z</time></trkpt>
      <trkpt lat="10.0010" lon="106.0000"><time>2026-06-01T07:01:00Z</time></trkpt>
      <trkpt lat="10.0020" lon="106.0000"><time>2026-06-01T07:02:30Z</time></trkpt>
    </trkseg>
  </trk>
<!-- `;
const GPX_TAIL = ` -->
</gpx>
`;

/** A valid open-water GPX swim padded with an XML comment to exactly `bytes` bytes. */
function gpxOfSize(bytes: number): Buffer {
  const fixed = Buffer.byteLength(GPX_HEAD) + Buffer.byteLength(GPX_TAIL);
  return Buffer.concat([
    Buffer.from(GPX_HEAD),
    Buffer.alloc(bytes - fixed, "x"),
    Buffer.from(GPX_TAIL),
  ]);
}

/**
 * Email prefix of every user this file signs up, per Playwright project, so the cleanup of one
 * project never removes the users of another project running at the same time.
 */
const emailPrefix = () => `upload-${test.info().project.name}-`;

/**
 * Deletes the users this file signed up, with their swims and swim results. `Swim.user` has no
 * `onDelete`, so leftover swims would block `db.user.deleteMany()` in the integration tests
 * that share this database.
 */
async function removeUploadUsers(): Promise<void> {
  const where = { user: { email: { startsWith: emailPrefix() } } };
  await db.xpEntry.deleteMany({ where });
  await db.swimResult.deleteMany({ where: { swim: where } });
  await db.swim.deleteMany({ where });
  await db.user.deleteMany({ where: where.user });
}

// The tests below only exercise the server, so one project is enough.
test.skip(({ isMobile }) => isMobile, "API-only tests run on the desktop project only");

test.beforeAll(removeUploadUsers);
test.afterAll(async () => {
  await removeUploadUsers();
  await db.$disconnect();
});

/** Signs up a fresh user with `request`, which then carries the session cookie. */
async function signUp(request: APIRequestContext, label: string): Promise<string> {
  const email = `${emailPrefix()}${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const res = await request.post("/api/auth/signup", {
    data: { email, password: "correct-horse-battery", displayName: "Lan" },
  });
  expect(res.status()).toBe(201);
  const { cookies } = await request.storageState();
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

const upload = (request: APIRequestContext, buffer: Buffer, name = "swim.gpx") =>
  request.post("/api/swims", {
    multipart: { file: { name, mimeType: "application/octet-stream", buffer } },
  });

/**
 * Posts `file` as multipart field `file` with `Transfer-Encoding: chunked` (no Content-Length),
 * the way a streaming client would. Resolves with the status and parsed JSON body.
 */
function uploadChunked(
  baseURL: string,
  cookie: string,
  file: Buffer,
  name: string,
): Promise<{ status: number; body: unknown }> {
  const boundary = `----e2e${Date.now()}`;
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([head, file, tail]);

  return new Promise((resolve, reject) => {
    let answered = false;
    const req = httpRequest(
      new URL("/api/swims", baseURL),
      {
        method: "POST",
        headers: {
          cookie,
          "content-type": `multipart/form-data; boundary=${boundary}`,
          "transfer-encoding": "chunked",
        },
      },
      (res) => {
        answered = true;
        const parts: Buffer[] = [];
        res.on("data", (c: Buffer) => parts.push(c));
        res.on("end", () => {
          const text = Buffer.concat(parts).toString("utf8");
          resolve({ status: res.statusCode ?? 0, body: JSON.parse(text) });
        });
        res.on("error", reject);
      },
    );
    // The server may answer and close before the whole body is sent; that is not a failure.
    req.on("error", (err) => {
      if (!answered) reject(err);
    });
    for (let at = 0; at < body.length; at += 64 * 1024) {
      req.write(body.subarray(at, at + 64 * 1024));
    }
    req.end();
  });
}

const tooLarge = { error: { code: "FILE_TOO_LARGE" } };

test("a chunked upload of about 11.5 MB is refused with FILE_TOO_LARGE", async ({
  request,
  baseURL,
}) => {
  const cookie = await signUp(request, "chunk11");
  const res = await uploadChunked(baseURL!, cookie, gpxOfSize(11.5 * MB), "big.gpx");
  expect(res.status).toBe(400);
  expect(res.body).toMatchObject(tooLarge);
});

test("a chunked upload of about 20 MB is refused with FILE_TOO_LARGE", async ({
  request,
  baseURL,
}) => {
  const cookie = await signUp(request, "chunk20");
  const res = await uploadChunked(baseURL!, cookie, Buffer.alloc(20 * MB, 1), "z.fit");
  expect(res.status).toBe(400);
  expect(res.body).toMatchObject(tooLarge);
});

test("an upload of 10 MB + 10 KB with Content-Length is refused with FILE_TOO_LARGE", async ({
  request,
}) => {
  await signUp(request, "over10");
  const res = await upload(request, gpxOfSize(MAX_UPLOAD_BYTES + 10 * 1024));
  expect(res.status()).toBe(400);
  expect(await res.json()).toMatchObject(tooLarge);
});

test("a valid GPX of exactly 10 MB is stored (201)", async ({ request }) => {
  await signUp(request, "exact10");
  const res = await upload(request, gpxOfSize(MAX_UPLOAD_BYTES));
  expect(res.status()).toBe(201);
  expect((await res.json()).swim).toMatchObject({ source: "GPX", swimType: "OPEN_WATER" });
});

test("a valid GPX just under 10 MB is stored (201)", async ({ request }) => {
  await signUp(request, "under10");
  const res = await upload(request, gpxOfSize(MAX_UPLOAD_BYTES - 1000));
  expect(res.status()).toBe(201);
  expect((await res.json()).swim).toMatchObject({ source: "GPX", swimType: "OPEN_WATER" });
});

test("an upload without a session is still refused with 401 UNAUTHENTICATED", async ({
  request,
}) => {
  const res = await upload(request, gpxOfSize(64 * 1024));
  expect(res.status()).toBe(401);
  expect(await res.json()).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
});
