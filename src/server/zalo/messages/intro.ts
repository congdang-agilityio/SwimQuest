import type { SwimTypeAllowed } from "@prisma/client";
import { utcToVnParts } from "@/lib/time/vn";
import { db } from "@/server/db";
import routesVi from "../../../../messages/vi/routes.json";
import type { ZaloStoredPayload } from "../render";

/** The tournament fields the Vietnamese rules summary is built from. */
export interface RulesSource {
  routeId: string;
  routeDistanceM: number;
  swimTypeAllowed: SwimTypeAllowed;
  dailyLimitM: number;
}

const SWIM_TYPES_VI: Record<SwimTypeAllowed, string> = {
  ANY: "bơi hồ và bơi ngoài trời",
  POOL_ONLY: "chỉ bơi hồ",
  OPEN_WATER_ONLY: "chỉ bơi ngoài trời",
};

const KM = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

/** Metres as Vietnamese kilometres, e.g. 25500 -> "25,5 km", 123450 -> "123,45 km". */
export function kmVi(metres: number): string {
  return `${KM.format(metres / 1000)} km`;
}

/** "dd/MM/yyyy HH:mm" in Vietnam time, whatever the server time zone. */
export function dateTimeVi(instant: Date): string {
  const { date, time } = utcToVnParts(instant);
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y} ${time}`;
}

function routeNameVi(routeId: string): string {
  const names = routesVi as Record<string, unknown>;
  const route = names[routeId] as { name?: unknown } | undefined;
  return typeof route?.name === "string" ? route.name : routeId;
}

/** The rules lines shared by Zalo messages: route and distance, swim types, daily limit. */
export function rulesSummaryVi(t: RulesSource): string[] {
  return [
    `Lộ trình: ${routeNameVi(t.routeId)}, ${kmVi(t.routeDistanceM)}`,
    `Loại bơi được tính: ${SWIM_TYPES_VI[t.swimTypeAllowed]}`,
    `Giới hạn mỗi ngày: ${kmVi(t.dailyLimitM)} cho mỗi người chơi`,
  ];
}

/**
 * The tournament introduction (S-85 AC 4), in Vietnamese, from the current data: name, season
 * dates, rules and the invite link `<origin>/join/<token>` (left out while the link is off or
 * not created yet). The origin is the one the bot's webhook was registered for. Null when the
 * tournament no longer exists.
 */
export async function renderIntro(payload: ZaloStoredPayload): Promise<string | null> {
  const tournamentId = typeof payload.tournamentId === "string" ? payload.tournamentId : "";
  if (!tournamentId) return null;
  const t = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      name: true,
      seasonStartAt: true,
      seasonEndAt: true,
      routeId: true,
      routeDistanceM: true,
      swimTypeAllowed: true,
      dailyLimitM: true,
      inviteToken: true,
      inviteEnabled: true,
      zalo: { select: { zaloBot: { select: { origin: true } } } },
    },
  });
  if (!t) return null;
  const lines = [
    `Chào mừng cả nhóm đến với giải bơi "${t.name}" trên SwimQuest!`,
    "",
    `Mùa giải: từ ${dateTimeVi(t.seasonStartAt)} đến ${dateTimeVi(t.seasonEndAt)} (giờ Việt Nam)`,
    ...rulesSummaryVi(t),
  ];
  const origin = t.zalo?.zaloBot.origin ?? process.env.APP_URL?.trim();
  if (t.inviteEnabled && t.inviteToken && origin) {
    lines.push("", `Tham gia giải: ${origin.replace(/\/+$/, "")}/join/${t.inviteToken}`);
  }
  lines.push("", "Nhóm sẽ nhận tin về đội mới, buổi bơi được tính và các cột mốc của giải.");
  return lines.join("\n");
}
