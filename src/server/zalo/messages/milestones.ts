import { getRoute } from "@/lib/routes";
import { db } from "@/server/db";
import routesVi from "../../../../messages/vi/routes.json";
import type { ZaloStoredPayload } from "../render";
import { dateTimeVi } from "./intro";

/** What a MILESTONE message announces. */
export type MilestoneType = "DESTINATION" | "FINISH" | "FINISH_LOST";

/** A destination's Vietnamese name from the route messages, e.g. "cu_lao_cham" -> "Cù Lao Chàm". */
export function destinationNameVi(routeId: string, slug: string): string {
  const route = (routesVi as Record<string, unknown>)[routeId];
  const name =
    route && typeof route === "object" ? (route as Record<string, unknown>)[slug] : undefined;
  return typeof name === "string" ? name : slug;
}

/**
 * MILESTONE (S-88): a team's ship passed a destination, reached Lý Sơn (finish date and time in
 * Vietnam time, from the payload so a later loss does not change it), or is no longer at Lý Sơn.
 * Null when the team is gone or the payload is unknown.
 */
export async function renderMilestone(payload: ZaloStoredPayload): Promise<string | null> {
  const teamId = typeof payload.teamId === "string" ? payload.teamId : "";
  const team = teamId
    ? await db.team.findUnique({
        where: { id: teamId },
        select: { name: true, tournament: { select: { name: true, routeId: true } } },
      })
    : null;
  if (!team) return null;
  const { name: tournament, routeId } = team.tournament;
  const finishSlug = getRoute(routeId)?.destinations.find((d) => d.isFinish)?.slug ?? "ly_son";
  const finish = destinationNameVi(routeId, finishSlug);
  switch (payload.milestone) {
    case "DESTINATION": {
      const slug = typeof payload.destination === "string" ? payload.destination : "";
      if (!slug) return null;
      return `[${tournament}] Con thuyền của đội "${team.name}" đã đi qua ${destinationNameVi(routeId, slug)}!`;
    }
    case "FINISH": {
      const at = typeof payload.finishedAt === "number" ? new Date(payload.finishedAt) : null;
      const when = at ? ` lúc ${dateTimeVi(at)} (giờ Việt Nam)` : "";
      return `[${tournament}] Chúc mừng đội "${team.name}" đã về đích ${finish}${when}!`;
    }
    case "FINISH_LOST":
      return `[${tournament}] Đội "${team.name}" không còn ở ${finish} nữa (tiến độ đã giảm dưới 100%).`;
    default:
      return null;
  }
}
