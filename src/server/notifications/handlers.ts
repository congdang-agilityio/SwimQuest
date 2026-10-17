import type { NotificationCategory, Prisma } from "@prisma/client";
import { after } from "next/server";
import { destinationsPassed } from "@/lib/routes/destinations-passed";
import type { MapPoint } from "@/lib/routes/path-position";
import route01Anchors from "../../../public/art/route01/map-anchors.json";
import type { EventHandler, EventTx } from "../events/handlers";
import type { DomainEventType } from "../events/types";
import { sendPendingPushes } from "../push/send";

const anchorsByRoute: Record<string, Record<string, MapPoint>> = {
  route01: route01Anchors.anchors,
};

/** An internal path only: starts with one "/", no scheme, no backslash, no control characters. */
export function assertInternalLink(link: string): string {
  if (!/^\/(?![/\\])[^\\\u0000-\u001f]*$/.test(link)) {
    throw new Error(`Notification link must be an internal path: ${link}`);
  }
  return link;
}

type Draft = {
  userIds: string[];
  category: NotificationCategory;
  type: string;
  /** Ids and slugs only; texts are rendered from messages in the reader's language. */
  params: Prisma.InputJsonObject;
  link: string;
};

async function notify(tx: EventTx, d: Draft): Promise<void> {
  const link = assertInternalLink(d.link);
  const userIds = [...new Set(d.userIds)];
  if (userIds.length === 0) return;
  await tx.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      category: d.category,
      type: d.type,
      params: d.params,
      link,
    })),
  });
  schedulePush();
}

/**
 * Pushes the new notifications once the response is sent (after the transaction committed).
 * Outside a request (scripts, tests) there is nothing to schedule: the next tick sends them.
 * A delivery failure never fails the request that created the notification.
 */
function schedulePush(): void {
  try {
    after(() => sendPendingPushes().then(() => undefined));
  } catch {
    // Not in a request scope.
  }
}

async function activeMembers(tx: EventTx, teamId: string): Promise<string[]> {
  const rows = await tx.teamMember.findMany({
    where: { teamId, status: "ACTIVE" },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

const swimTypes: Partial<Record<string, string>> = {
  VERIFIED: "swim.verified",
  FLAGGED: "swim.flagged",
  REJECTED: "swim.rejected",
  REVOKED: "swim.revoked",
  RULE_MISSED: "swim.ruleMissed",
};

type Handlers = { [T in DomainEventType]?: EventHandler<T> };

export const notificationHandlers: Handlers = {
  SWIM_RESULT_CHANGED: (tx, p) => {
    if (p.status === p.previousStatus) return;
    const decided = p.previousStatus === "DISPUTED" && p.status !== "DISPUTED";
    const type = decided ? "swim.disputeDecided" : swimTypes[p.status];
    if (!type) return;
    return notify(tx, {
      userIds: [p.userId],
      category: "VERIFICATION",
      type,
      params: { swimId: p.swimId, resultId: p.resultId, status: p.status },
      link: `/swims/${encodeURIComponent(p.swimId)}`,
    });
  },
  PLAYER_ADDED_TO_TEAM: (tx, p) =>
    notify(tx, {
      userIds: [p.userId],
      category: "INVITATIONS",
      type: "team.invited",
      params: { teamId: p.teamId, tournamentId: p.tournamentId },
      link: "/team",
    }),
  TEAM_JOINED: (tx, p) => teamNotice(tx, [p.userId], "team.joined", p),
  TEAM_MEMBER_MOVED: (tx, p) =>
    teamNotice(tx, [p.userId], "team.moved", p, { fromTeamId: p.fromTeamId }),
  TEAM_MEMBER_REMOVED: (tx, p) => teamNotice(tx, [p.userId], "team.removed", p),
  TEAM_CAPTAIN_SET: (tx, p) => teamNotice(tx, [p.userId], "team.captainSet", p),
  TEAM_START_SET: async (tx, p) => {
    const team = await tx.team.findUnique({
      where: { id: p.teamId },
      select: { startSetBy: true },
    });
    const type = team?.startSetBy === "AUTOMATIC" ? "team.startAssigned" : "team.startChosen";
    await teamNotice(tx, await activeMembers(tx, p.teamId), type, p, { startId: p.startId });
  },
  TEAM_START_LOCKED: async (tx, p) =>
    teamNotice(tx, await activeMembers(tx, p.teamId), "team.startLocked", p, {
      startId: p.startId,
    }),
  TEAM_PROGRESS_CHANGED: async (tx, p) => {
    const team = await tx.team.findUnique({
      where: { id: p.teamId },
      select: { startDestination: true, tournament: { select: { routeId: true } } },
    });
    const anchors = team && anchorsByRoute[team.tournament.routeId];
    if (!team?.startDestination || !anchors) return;
    const passed = destinationsPassed(
      team.tournament.routeId,
      anchors,
      team.startDestination,
      p.fromBp,
      p.toBp,
    );
    if (passed.length === 0) return;
    const userIds = await activeMembers(tx, p.teamId);
    for (const d of passed) {
      await milestone(tx, userIds, "milestone.destinationPassed", p, { destination: d.slug });
    }
  },
  TEAM_FINISHED: async (tx, p) =>
    milestone(tx, await activeMembers(tx, p.teamId), "milestone.finished", p),
  TEAM_FINISH_LOST: async (tx, p) =>
    milestone(tx, await activeMembers(tx, p.teamId), "milestone.finishLost", p),
  BADGE_AWARDED: (tx, p) =>
    notify(tx, {
      userIds: [p.userId],
      category: "MILESTONES",
      type: "milestone.badgeEarned",
      params: { badgeKey: p.badgeKey },
      link: "/profile",
    }),
  LEVEL_CHANGED: (tx, p) => {
    if (p.toLevel <= p.fromLevel) return;
    return notify(tx, {
      userIds: [p.userId],
      category: "MILESTONES",
      type: "milestone.levelUp",
      params: { level: p.toLevel },
      link: "/profile",
    });
  },
};

type TeamIds = { teamId: string; tournamentId: string };

function teamNotice(
  tx: EventTx,
  userIds: string[],
  type: string,
  p: TeamIds,
  extra: Prisma.InputJsonObject = {},
) {
  const params = { teamId: p.teamId, tournamentId: p.tournamentId, ...extra };
  return notify(tx, { userIds, category: "TEAM", type, params, link: "/team" });
}

function milestone(
  tx: EventTx,
  userIds: string[],
  type: string,
  p: TeamIds,
  extra: Prisma.InputJsonObject = {},
) {
  const params = { teamId: p.teamId, tournamentId: p.tournamentId, ...extra };
  return notify(tx, { userIds, category: "MILESTONES", type, params, link: "/voyage" });
}
