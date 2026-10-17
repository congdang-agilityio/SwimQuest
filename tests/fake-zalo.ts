import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

/** One request the fake received: the bot key and method from `/bot<key>/<method>`. */
export interface FakeZaloCall {
  key: string;
  method: string;
  body: unknown;
}

/** A canned answer: HTTP status and JSON body, or `hang` to never answer (timeouts). */
export type FakeZaloAnswer = { status?: number; body?: unknown } | "hang";

export interface FakeZalo {
  /** Base URL to use as `ZALO_BOT_API_URL`. */
  url: string;
  calls: FakeZaloCall[];
  /** Sets the answer for one method; methods without one answer `{ ok: true, result: {} }`. */
  answer(method: string, answer: FakeZaloAnswer): void;
  close(): Promise<void>;
}

/**
 * A local stand-in for the Zalo Bot API (`POST /bot<key>/<method>`, Telegram-style answers).
 * It records every call and can answer errors or hang. Start one per test file.
 */
export async function startFakeZalo(): Promise<FakeZalo> {
  const calls: FakeZaloCall[] = [];
  const answers = new Map<string, FakeZaloAnswer>();
  const hanging = new Set<ServerResponse>();

  const server: Server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const match = /^\/bot([^/]+)\/([A-Za-z]+)$/.exec(req.url ?? "");
    const raw = await readBody(req);
    if (!match || req.method !== "POST") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error_code: 404, description: "Not Found" }));
      return;
    }
    const [, key, method] = match;
    calls.push({ key: decodeURIComponent(key), method, body: parseJson(raw) });
    const answer = answers.get(method) ?? { status: 200, body: { ok: true, result: {} } };
    if (answer === "hang") {
      hanging.add(res);
      return;
    }
    res.writeHead(answer.status ?? 200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(answer.body ?? { ok: true, result: {} }));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    calls,
    answer: (method, answer) => void answers.set(method, answer),
    close: () =>
      new Promise<void>((resolve) => {
        for (const res of hanging) res.destroy();
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function parseJson(raw: string): unknown {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return raw;
  }
}
