import { resolvePrivacy, canSeeField } from "@/lib/privacy";
import { vnDayKey } from "@/lib/time/vn";
import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/record";
import { requireOrganizer } from "@/server/auth/roles";
import { db } from "@/server/db";

export type TournamentExport = { filename: string; csv: string };

const BOM = "﻿";
const HEADER = [
  "Đội / Team",
  "Đội trưởng / Captain",
  "Tên hiển thị / Name",
  "Km đã xác minh / Verified km",
  "Điểm / Points",
];
const YES_NO = ["Có / Yes", "Không / No"] as const;
const TOTAL_LABEL = "Tổng đội / Team total";
/** Shown instead of a name the player keeps private. */
const HIDDEN = "—";

/** One CSV cell: RFC 4180 quoting, and a leading `'` against spreadsheet formula injection. */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const km = (metres: number) => (metres / 1000).toFixed(1);

function slugify(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replaceAll("đ", "d")
    .replaceAll("Đ", "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "tournament";
}

/**
 * The organizer's CSV of teams, active members and their current verified km and points
 * (story S-79). Organizer only (throws the role errors of `requireOrganizer`). Values are read
 * at export time. Never holds emails, tracks, files, notes or report data; a player's display
 * name and numbers follow their privacy settings as seen by someone in the same tournament.
 * Team rows count everything stored on the team, members who left included. The export is
 * audited with the row count only.
 */
export async function exportTournament(
  organizerId: string,
  tournamentId: string,
  now: Date,
): Promise<TournamentExport> {
  const tournament = await requireOrganizer(organizerId, tournamentId);

  const [teams, members, results, entries] = await Promise.all([
    db.team.findMany({
      where: { tournamentId },
      select: { id: true, name: true, captainUserId: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    db.teamMember.findMany({
      where: { tournamentId, status: "ACTIVE" },
      select: {
        teamId: true,
        userId: true,
        user: { select: { displayName: true, privacy: true } },
      },
    }),
    db.swimResult.groupBy({
      by: ["teamId", "userId"],
      where: { tournamentId, status: "VERIFIED" },
      _sum: { countedM: true },
    }),
    db.pointsEntry.groupBy({
      by: ["teamId", "userId"],
      where: { tournamentId },
      _sum: { points: true },
    }),
  ]);

  const key = (teamId: string, userId: string) => `${teamId}\u0000${userId}`;
  const metres = new Map(results.map((r) => [key(r.teamId, r.userId), r._sum.countedM ?? 0]));
  const points = new Map(entries.map((e) => [key(e.teamId, e.userId), e._sum.points ?? 0]));
  const teamMetres = new Map<string, number>();
  const teamPoints = new Map<string, number>();
  for (const r of results)
    teamMetres.set(r.teamId, (teamMetres.get(r.teamId) ?? 0) + (r._sum.countedM ?? 0));
  for (const e of entries)
    teamPoints.set(e.teamId, (teamPoints.get(e.teamId) ?? 0) + (e._sum.points ?? 0));

  const lines: (string | number)[][] = [HEADER];
  for (const team of teams) {
    const roster = members
      .filter((m) => m.teamId === team.id)
      .sort((a, b) => a.user.displayName.localeCompare(b.user.displayName, "vi"));
    for (const m of roster) {
      const privacy = resolvePrivacy(m.user.privacy);
      const shows = (field: "displayName" | "stats") =>
        canSeeField(privacy, field, "SHARES_TOURNAMENT");
      lines.push([
        team.name,
        YES_NO[team.captainUserId === m.userId ? 0 : 1],
        shows("displayName") ? m.user.displayName : HIDDEN,
        shows("stats") ? km(metres.get(key(team.id, m.userId)) ?? 0) : "",
        shows("stats") ? (points.get(key(team.id, m.userId)) ?? 0) : "",
      ]);
    }
    lines.push([
      team.name,
      "",
      TOTAL_LABEL,
      km(teamMetres.get(team.id) ?? 0),
      teamPoints.get(team.id) ?? 0,
    ]);
  }

  const rowCount = lines.length - 1;
  await db.$transaction((tx) =>
    recordAudit(tx, {
      actor: { type: "USER", userId: organizerId },
      action: AUDIT_ACTIONS.TOURNAMENT_EXPORTED,
      entityType: "Tournament",
      entityId: tournament.id,
      tournamentId: tournament.id,
      after: { rows: rowCount },
    }),
  );

  return {
    filename: `${slugify(tournament.name)}-${vnDayKey(now)}.csv`,
    csv: BOM + lines.map((line) => line.map(csvCell).join(",")).join("\r\n") + "\r\n",
  };
}
