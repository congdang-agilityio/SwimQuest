import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { runPendingZalo } from "@/server/jobs/tick";
import { startFakeZalo, type FakeZalo } from "../../../tests/fake-zalo";
import { encryptSecret } from "./secret";

/**
 * S-89 AC 4 (#465): swims, points, progress and the finish work normally while Zalo delivery
 * fails. The upload goes through the real API route; Zalo is the local fake (never the real API).
 */
const jar = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "sq_session" && jar.token !== undefined ? { name, value: jar.token } : undefined,
  }),
}));
const { POST } = await import("@/app/api/swims/route");

const HOUR = 3_600_000;

/** An open-water GPX of about 1 km (10 legs of ~111 m) in 20 minutes, ending an hour ago. */
function recentGpx(): Buffer {
  const start = Date.now() - 2 * HOUR;
  const points = Array.from({ length: 11 }, (_, i) => {
    const time = new Date(start + i * 120_000).toISOString();
    return `<trkpt lat="${(10 + i * 0.001).toFixed(4)}" lon="106.0000"><time>${time}</time></trkpt>`;
  });
  return Buffer.from(
    `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><type>open_water_swimming</type><trkseg>${points.join("")}</trkseg></trk>
</gpx>`,
  );
}

function upload(file: Buffer) {
  const form = new FormData();
  form.set("file", new File([new Uint8Array(file)], "swim.gpx"));
  return POST(new Request("http://localhost/api/swims", { method: "POST", body: form }));
}

async function clean() {
  await db.zaloSwimPost.deleteMany();
  await db.zaloMessage.deleteMany();
  await db.tournamentZalo.deleteMany();
  await db.zaloBot.deleteMany();
  await db.domainEvent.deleteMany();
  await db.notification.deleteMany();
  await db.funnelEvent.deleteMany();
  await db.badge.deleteMany();
  await db.weeklyResult.deleteMany();
  await db.pointsEntry.deleteMany();
  await db.swimResult.deleteMany();
  await db.xpEntry.deleteMany();
  await db.xpWeek.deleteMany();
  await db.swim.deleteMany();
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}

/** An active tournament with one team and a linked Zalo group; the swimmer is signed in. */
async function setup() {
  const organizer = await db.user.create({
    data: { email: "org@example.com", passwordHash: "h", displayName: "Organizer" },
  });
  const swimmer = await db.user.create({
    data: { email: "swimmer@example.com", passwordHash: "h", displayName: "Lan" },
  });
  const tournament = await db.tournament.create({
    data: {
      organizerId: organizer.id,
      status: "ACTIVE",
      name: "Cup",
      description: "Swim around the bay",
      seasonStartAt: new Date(Date.now() - 10 * 24 * HOUR),
      seasonEndAt: new Date(Date.now() + 30 * 24 * HOUR),
      routeId: "route01",
      // 500 m of route: a 1 km swim finishes it.
      routeDistanceM: 500,
      inviteToken: "token-resilience",
      publishedAt: new Date(Date.now() - 20 * 24 * HOUR),
    },
  });
  const team = await db.team.create({
    data: {
      tournamentId: tournament.id,
      name: "Dolphins",
      emblemKey: "dolphin",
      memberLimit: 4,
      startDestination: "non_nuoc",
    },
  });
  await db.teamMember.create({
    data: { teamId: team.id, tournamentId: tournament.id, userId: swimmer.id },
  });
  const bot = await db.zaloBot.create({
    data: {
      ownerUserId: organizer.id,
      botId: "bot-1",
      botName: "SwimQuest bot",
      tokenEnc: encryptSecret("bot-key"),
      tokenHint: "-key",
      hookId: "hook-resilience",
      secretEnc: encryptSecret("hook-secret"),
      origin: "http://localhost:3000",
      webhookOk: true,
      chatId: "group-1",
      linkedAt: new Date(),
    },
  });
  await db.tournamentZalo.create({ data: { tournamentId: tournament.id, zaloBotId: bot.id } });
  jar.token = (await createSession(swimmer.id)).token;
  return { tournament, team, swimmer, bot };
}

describe("the game is unaffected when Zalo delivery fails (S-89 AC 4)", () => {
  let fake: FakeZalo;
  const env = { ...process.env };

  beforeAll(async () => {
    fake = await startFakeZalo();
    process.env.ZALO_KEY_SECRET = randomBytes(32).toString("base64");
  });
  beforeEach(async () => {
    await clean();
    fake.calls.length = 0;
  });
  afterAll(async () => {
    await clean();
    await fake.close();
    process.env = env;
    await db.$disconnect();
  });

  it.each([
    ["answers 500", "500", /500/, "PENDING"],
    ["answers 403", "403", /403/, "FAILED"],
    ["is unreachable", "down", /unreachable/, "PENDING"],
  ] as const)("when Zalo %s", async (_case, mode, reason, status) => {
    if (mode === "down") {
      process.env.ZALO_BOT_API_URL = "http://127.0.0.1:1";
    } else {
      process.env.ZALO_BOT_API_URL = fake.url;
      const code = Number(mode);
      fake.answer("sendMessage", {
        status: code,
        body: { ok: false, error_code: code, description: `failure ${code}` },
      });
    }
    const { tournament, team, swimmer, bot } = await setup();

    // The upload succeeds and the swim counts.
    const res = await upload(recentGpx());
    expect(res.status).toBe(201);
    const { swim } = (await res.json()) as { swim: { id: string } };
    const result = await db.swimResult.findUniqueOrThrow({
      where: { swimId_tournamentId: { swimId: swim.id, tournamentId: tournament.id } },
    });
    expect(result.status).toBe("VERIFIED");

    // Points, team progress and the finish are recorded.
    const points = await db.pointsEntry.aggregate({
      where: { tournamentId: tournament.id, userId: swimmer.id },
      _sum: { points: true },
    });
    expect(points._sum.points ?? 0).toBeGreaterThan(0);
    const after = await db.team.findUniqueOrThrow({ where: { id: team.id } });
    expect(after.progressBp).toBe(10000);
    expect(after.finishedAt).not.toBeNull();

    // The swim, the destinations passed and the finish wait in the outbox.
    const kinds = (await db.zaloMessage.findMany({ select: { kind: true } })).map((m) => m.kind);
    expect(kinds).toContain("COUNTED_SWIM");
    expect(kinds.filter((k) => k === "MILESTONE").length).toBeGreaterThanOrEqual(2);

    // A tick tries to deliver and does not throw; the failure is recorded.
    await expect(runPendingZalo(new Date())).resolves.toBeDefined();
    const tried = await db.zaloMessage.findMany({ where: { attempts: { gt: 0 } } });
    expect(tried.length).toBeGreaterThan(0);
    for (const m of tried) {
      expect(m.status).toBe(status);
      expect(m.lastError).toMatch(reason);
    }
    expect(await db.zaloMessage.count({ where: { status: "SENT" } })).toBe(0);
    const failedBot = await db.zaloBot.findUniqueOrThrow({ where: { id: bot.id } });
    expect(failedBot.lastError).toMatch(reason);
    expect(failedBot.lastErrorAt).not.toBeNull();
    if (mode !== "down") {
      // The texts were rendered (in Vietnamese, with the display name) before Zalo refused them.
      expect(JSON.stringify(fake.calls)).toContain("Lan");
    }

    // The next tick retries without throwing; the game data is unchanged.
    await expect(runPendingZalo(new Date())).resolves.toBeDefined();
    if (status === "PENDING") {
      const first = await db.zaloMessage.findUniqueOrThrow({ where: { id: tried[0].id } });
      expect(first.attempts).toBe(2);
    }
    const again = await db.team.findUniqueOrThrow({ where: { id: team.id } });
    expect(again.progressBp).toBe(10000);
    expect(again.finishedAt).toEqual(after.finishedAt);
    expect(await db.swimResult.count({ where: { id: result.id, status: "VERIFIED" } })).toBe(1);
  });
});
