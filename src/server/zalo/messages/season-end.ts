import { ZALO_TEXT_LIMIT } from "@/server/zalo/client";
import { db } from "@/server/db";
import { getProgressLeaderboard } from "@/server/leaderboard/progress-leaderboard";
import type { ZaloStoredPayload } from "../render";
import { dateTimeVi } from "./intro";
import { percentVi } from "./swim";
import { playerNameVi } from "./team";

/** Room kept for the "và N đội khác" line under Zalo's 2000 characters. */
const MORE_LINE_ROOM = 40;

export type SeasonEndTeam = { name: string; progressBp: number; finishedAt: Date | null };
export type SeasonEndPlayer = { name: string; points: number };

/**
 * The season end text (S-88 AC 4): final team ranking in the leaderboard's order (progress, or
 * the finish date for finished teams) and the top 3 players by points. Teams that do not fit in
 * Zalo's 2000 characters are cut and counted as "và N đội khác".
 */
export function seasonEndText(
  tournament: string,
  teams: SeasonEndTeam[],
  players: SeasonEndPlayer[],
): string {
  const head = [
    `Mùa giải "${tournament}" đã kết thúc! Cảm ơn cả nhóm đã cùng bơi.`,
    "",
    "Bảng xếp hạng đội cuối cùng:",
  ];
  const tail: string[] = [];
  if (players.length > 0) {
    tail.push("", "Top người chơi theo điểm:");
    players.forEach((p, i) => tail.push(`${i + 1}. ${p.name}: ${p.points} điểm`));
  }
  const teamLines = teams.map(
    (t, i) =>
      `${i + 1}. ${t.name}: ` +
      (t.progressBp >= 10000 && t.finishedAt
        ? `về đích ${dateTimeVi(t.finishedAt)}`
        : percentVi(t.progressBp)),
  );
  if (teamLines.length === 0) teamLines.push("(chưa có đội nào)");

  const fixed = [...head, ...tail].join("\n").length + 1;
  const budget = ZALO_TEXT_LIMIT - fixed - MORE_LINE_ROOM;
  const shown: string[] = [];
  let used = 0;
  for (const line of teamLines) {
    if (used + line.length + 1 > budget) break;
    shown.push(line);
    used += line.length + 1;
  }
  const hidden = teamLines.length - shown.length;
  if (hidden > 0) shown.push(`và ${hidden} đội khác`);
  return [...head, ...shown, ...tail].join("\n");
}

/** SEASON_END: the final leaderboards of the tournament, read when the message is sent. */
export async function renderSeasonEnd(payload: ZaloStoredPayload): Promise<string | null> {
  const id = typeof payload.tournamentId === "string" ? payload.tournamentId : "";
  const t = id
    ? await db.tournament.findUnique({ where: { id }, select: { name: true, organizerId: true } })
    : null;
  if (!t) return null;
  // Read as the organizer, who may always see the leaderboard.
  const ranking = await getProgressLeaderboard(t.organizerId, id);
  const sums = await db.pointsEntry.groupBy({
    by: ["userId"],
    where: { tournamentId: id },
    _sum: { points: true },
  });
  const top = sums
    .map((s) => ({ userId: s.userId, points: s._sum.points ?? 0 }))
    .filter((s) => s.points > 0)
    .sort((a, b) => b.points - a.points || (a.userId < b.userId ? -1 : 1))
    .slice(0, 3);
  const users = await db.user.findMany({
    where: { id: { in: top.map((s) => s.userId) } },
    select: { id: true, displayName: true, privacy: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  const players = top.map((s) => ({
    name: playerNameVi(byId.get(s.userId) ?? null),
    points: s.points,
  }));
  return seasonEndText(t.name, ranking, players);
}
