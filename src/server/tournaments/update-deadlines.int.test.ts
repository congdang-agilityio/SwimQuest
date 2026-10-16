import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { startLockAt } from "@/lib/tournaments/lifecycle";
import { db } from "@/server/db";
import { assignMissingStarts } from "@/server/starts/auto-assign";
import { updateSettings } from "./update-settings";

const SEASON_START = new Date("2099-11-01T06:00:00+07:00");
const NOW = new Date("2099-10-01T00:00:00+07:00");

async function clean() {
  await db.domainEvent.deleteMany();
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
  await db.session.deleteMany();
  await db.user.deleteMany();
}

async function setup() {
  const organizer = await db.user.create({
    data: { email: "organizer@example.com", passwordHash: "h", displayName: "organizer" },
  });
  const t = await db.tournament.create({
    data: {
      organizerId: organizer.id,
      status: "PUBLISHED",
      inviteToken: "token-deadlines",
      name: "Cup",
      description: "d",
      seasonStartAt: SEASON_START,
      seasonEndAt: new Date("2099-12-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100000,
    },
  });
  return { organizer, t };
}

beforeEach(clean);
afterAll(async () => {
  await clean();
  await db.$disconnect();
});

describe("updateSettings deadlines", () => {
  it("saves N, M and an earlier deadline; startLockAt and auto-assign follow it", async () => {
    const { organizer, t } = await setup();
    const result = await updateSettings(
      organizer.id,
      t.id,
      "deadlines",
      {
        submissionDays: 10,
        lateUploadDays: "5",
        startChoiceDeadlineDate: "2099-10-30",
        startChoiceDeadlineTime: "12:00",
      },
      NOW,
    );
    expect(result.ok).toBe(true);
    const row = await db.tournament.findUniqueOrThrow({ where: { id: t.id } });
    const deadline = new Date("2099-10-30T12:00:00+07:00");
    expect(row).toMatchObject({ submissionDays: 10, lateUploadDays: 5 });
    expect(row.startChoiceDeadlineAt).toEqual(deadline);
    expect(startLockAt(row)).toEqual(deadline);

    const team = await db.team.create({
      data: { tournamentId: t.id, name: "Dolphins", emblemKey: "dolphin", memberLimit: 5 },
    });
    expect(await assignMissingStarts(t.id, new Date(deadline.getTime() - 1))).toEqual([]);
    const assigned = await assignMissingStarts(t.id, deadline);
    expect(assigned.map((a) => a.teamId)).toEqual([team.id]);
  });

  it("an empty deadline stores null; a deadline after the season start is refused", async () => {
    const { organizer, t } = await setup();
    const late = await updateSettings(
      organizer.id,
      t.id,
      "deadlines",
      { startChoiceDeadlineDate: "2099-11-01", startChoiceDeadlineTime: "06:01" },
      NOW,
    );
    expect(late).toEqual({
      ok: false,
      reason: "INVALID",
      errors: { startChoiceDeadlineDate: "DEADLINE_AFTER_SEASON_START" },
    });
    const ok = await updateSettings(organizer.id, t.id, "deadlines", {}, NOW);
    expect(ok.ok).toBe(true);
    const row = await db.tournament.findUniqueOrThrow({ where: { id: t.id } });
    expect(row.startChoiceDeadlineAt).toBeNull();
    expect(startLockAt(row)).toEqual(SEASON_START);
  });
});
