import { canSeeField, resolvePrivacy } from "@/lib/privacy";
import { db } from "@/server/db";
import type { ZaloStoredPayload } from "../render";
import { dateTimeVi, rulesSummaryVi } from "./intro";

/** Shown instead of the name of a player who hides their display name from outsiders. */
const HIDDEN_NAME = "Một thành viên";

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * A player's name for a Zalo group, which may include people outside the tournament: the display
 * name only while the player shows it to everyone (privacy "PUBLIC", the default), never the email.
 */
export function playerNameVi(user: { displayName: string; privacy: unknown } | null): string {
  if (!user) return HIDDEN_NAME;
  return canSeeField(resolvePrivacy(user.privacy), "displayName", "OTHER")
    ? user.displayName
    : HIDDEN_NAME;
}

export async function playerNameById(userId: string): Promise<string> {
  const user = userId
    ? await db.user.findUnique({
        where: { id: userId },
        select: { displayName: true, privacy: true },
      })
    : null;
  return playerNameVi(user);
}

/** The app origin the bot's webhook was registered for (links in messages). */
export function originOf(t: { zalo: { zaloBot: { origin: string } } | null }): string | null {
  const origin = t.zalo?.zaloBot.origin ?? process.env.APP_URL?.trim();
  return origin ? origin.replace(/\/+$/, "") : null;
}

/** "5/8": a team's size at the time of the event (stored in the payload) and its limit. */
function sizeVi(size: number | null, limit: number | null): string {
  return size === null ? "" : limit === null ? ` (${size} người)` : ` (${size}/${limit})`;
}

/**
 * NEW_TEAM: the team, its limit and the join link `<origin>/join/<token>?team=<teamId>` that
 * opens the join page with the team preselected (left out while the invite link is off).
 */
export async function renderNewTeam(payload: ZaloStoredPayload): Promise<string | null> {
  const team = await db.team.findUnique({
    where: { id: str(payload.teamId) },
    select: {
      id: true,
      name: true,
      memberLimit: true,
      tournament: {
        select: {
          name: true,
          inviteToken: true,
          inviteEnabled: true,
          zalo: { select: { zaloBot: { select: { origin: true } } } },
        },
      },
    },
  });
  if (!team) return null;
  const t = team.tournament;
  const lines = [`[${t.name}] Đội mới: "${team.name}" (tối đa ${team.memberLimit} người).`];
  const origin = originOf(t);
  if (t.inviteEnabled && t.inviteToken && origin) {
    const link = `${origin}/join/${t.inviteToken}?team=${encodeURIComponent(team.id)}`;
    lines.push(`Tham gia đội: ${link}`);
  }
  return lines.join("\n");
}

/** PLAYER_JOINED: the player's display name, the team and its size then (`5/8`). */
export async function renderPlayerJoined(payload: ZaloStoredPayload): Promise<string | null> {
  const [name, team] = await Promise.all([
    playerNameById(str(payload.userId)),
    db.team.findUnique({
      where: { id: str(payload.teamId) },
      select: { name: true, tournament: { select: { name: true } } },
    }),
  ]);
  if (!team) return null;
  const size = sizeVi(num(payload.size), num(payload.limit));
  return `[${team.tournament.name}] ${name} đã tham gia đội "${team.name}"${size}.`;
}

/** PLAYER_MOVED: the player, from-team and to-team with both sizes after the move. */
export async function renderPlayerMoved(payload: ZaloStoredPayload): Promise<string | null> {
  const [name, from, to] = await Promise.all([
    playerNameById(str(payload.userId)),
    db.team.findUnique({ where: { id: str(payload.fromTeamId) }, select: { name: true } }),
    db.team.findUnique({
      where: { id: str(payload.teamId) },
      select: { name: true, tournament: { select: { name: true } } },
    }),
  ]);
  if (!from || !to) return null;
  const fromSize = sizeVi(num(payload.fromSize), num(payload.fromLimit));
  const toSize = sizeVi(num(payload.toSize), num(payload.toLimit));
  return (
    `[${to.tournament.name}] Ban tổ chức đã chuyển ${name} ` +
    `từ đội "${from.name}"${fromSize} sang đội "${to.name}"${toSize}.`
  );
}

/** SEASON_START: the season is on, until when, and the rules summary. */
export async function renderSeasonStart(payload: ZaloStoredPayload): Promise<string | null> {
  const id = str(payload.tournamentId);
  const t = id
    ? await db.tournament.findUnique({
        where: { id },
        select: {
          name: true,
          seasonEndAt: true,
          routeId: true,
          routeDistanceM: true,
          swimTypeAllowed: true,
          dailyLimitM: true,
        },
      })
    : null;
  if (!t) return null;
  return [
    `Mùa giải "${t.name}" đã bắt đầu! Chúc cả nhóm bơi vui và an toàn.`,
    `Mùa giải kết thúc lúc ${dateTimeVi(t.seasonEndAt)} (giờ Việt Nam).`,
    "",
    ...rulesSummaryVi(t),
  ].join("\n");
}
