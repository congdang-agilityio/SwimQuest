import { db } from "@/server/db";

/** Shared rows for the join integration tests (not a test file itself). */
export async function cleanJoinRows() {
  await db.domainEvent.deleteMany();
  await db.swimResult.deleteMany();
  await db.swim.deleteMany();
  await db.pointsEntry.deleteMany();
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}

export const user = (n: string) =>
  db.user.create({ data: { email: `${n}@example.com`, passwordHash: "h", displayName: n } });

export const SEASON_START = new Date("2026-11-01T00:00:00+07:00");
export const SEASON_END = new Date("2026-12-01T00:00:00+07:00");
export const BEFORE_START = new Date("2026-10-20T00:00:00+07:00");

export async function tournamentWithTeams(
  status: "DRAFT" | "PUBLISHED" | "COMPLETED" = "PUBLISHED",
  limits: number[] = [2, 1],
) {
  const organizer = await user(`organizer-${status}`);
  const tournament = await db.tournament.create({
    data: {
      organizerId: organizer.id,
      status,
      name: "Cup",
      description: "Swim around the bay",
      seasonStartAt: SEASON_START,
      seasonEndAt: SEASON_END,
      routeId: "route01",
      routeDistanceM: 100000,
      eligibilityNotes: "Company staff",
      inviteToken: `token-${status}`,
      publishedAt: status === "DRAFT" ? null : new Date("2026-10-01T00:00:00Z"),
    },
  });
  const teams = [];
  for (const [i, memberLimit] of limits.entries()) {
    teams.push(
      await db.team.create({
        data: {
          tournamentId: tournament.id,
          name: `Team ${i}`,
          emblemKey: "dolphin",
          memberLimit,
          createdAt: new Date(Date.UTC(2026, 9, 1, 0, i)),
        },
      }),
    );
  }
  return { organizer, tournament, teams, token: tournament.inviteToken! };
}

export async function addMember(
  teamId: string,
  tournamentId: string,
  name: string,
  status: "ACTIVE" | "LEFT" = "ACTIVE",
) {
  const u = await user(name);
  await db.teamMember.create({ data: { teamId, tournamentId, userId: u.id, status } });
  return u;
}

export const DURING_SEASON = new Date("2026-11-10T00:00:00+07:00");

/** A past membership of `userId`, ended for `endReason` at `endedAt` (removals: REMOVED). */
export function endedMembership(
  teamId: string,
  tournamentId: string,
  userId: string,
  endReason: "LEFT" | "REMOVED_BEFORE_START" | "REMOVED_AFTER_START",
  joinedAt: Date,
  endedAt: Date,
) {
  const status = endReason === "LEFT" ? "LEFT" : "REMOVED";
  return db.teamMember.create({
    data: { teamId, tournamentId, userId, status, endReason, joinedAt, endedAt },
  });
}
