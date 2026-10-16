import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { PRIVACY_DEFAULTS } from "@/lib/privacy";
import { getPrivacy, setPrivacy } from "./privacy";

async function clean() {
  await db.pointsEntry.deleteMany();
  await db.swimResult.deleteMany();
  await db.swim.deleteMany();
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}

const user = (n: string) =>
  db.user.create({ data: { email: `${n}@example.com`, passwordHash: "h", displayName: n } });

describe("profile privacy", () => {
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("reads the defaults for a new player", async () => {
    const me = await user("me");
    expect(await getPrivacy(me.id)).toEqual(PRIVACY_DEFAULTS);
  });

  it("returns null for an unknown player", async () => {
    expect(await getPrivacy("00000000-0000-0000-0000-000000000000")).toBeNull();
    expect(await getPrivacy("")).toBeNull();
  });

  it("saves a partial change and keeps the other levels", async () => {
    const me = await user("me");
    const first = await setPrivacy(me.id, { bio: "PRIVATE", stats: "PUBLIC" });
    expect(first).toEqual({
      ok: true,
      privacy: { ...PRIVACY_DEFAULTS, bio: "PRIVATE", stats: "PUBLIC" },
    });
    await setPrivacy(me.id, { badges: "PRIVATE" });
    expect(await getPrivacy(me.id)).toEqual({
      ...PRIVACY_DEFAULTS,
      bio: "PRIVATE",
      stats: "PUBLIC",
      badges: "PRIVATE",
    });
  });

  it("does not touch other players", async () => {
    const me = await user("me");
    const other = await user("other");
    await setPrivacy(me.id, { bio: "PUBLIC" });
    expect(await getPrivacy(other.id)).toEqual(PRIVACY_DEFAULTS);
  });

  it("rejects making email public and stores nothing", async () => {
    const me = await user("me");
    expect(await setPrivacy(me.id, { email: "PUBLIC" })).toEqual({
      ok: false,
      error: "INVALID_PRIVACY",
    });
    expect(await setPrivacy(me.id, { bio: "PUBLIC", email: "PUBLIC" })).toEqual({
      ok: false,
      error: "INVALID_PRIVACY",
    });
    const row = await db.user.findUniqueOrThrow({ where: { id: me.id } });
    expect(row.privacy).toEqual({});
  });

  it("rejects unknown levels, unknown fields and non-objects", async () => {
    const me = await user("me");
    for (const input of [
      { bio: "everyone" },
      { bio: null },
      { nickname: "PUBLIC" },
      ["PUBLIC"],
      "PUBLIC",
      null,
    ]) {
      expect(await setPrivacy(me.id, input)).toEqual({ ok: false, error: "INVALID_PRIVACY" });
    }
    expect(await getPrivacy(me.id)).toEqual(PRIVACY_DEFAULTS);
  });

  it("reports an unknown player", async () => {
    expect(await setPrivacy("00000000-0000-0000-0000-000000000000", { bio: "PUBLIC" })).toEqual({
      ok: false,
      error: "NOT_FOUND",
    });
  });
});
