import type { Prisma, Tournament } from "@prisma/client";
import { effectiveStatus, isJoiningOpen, type TournamentStatus } from "@/lib/tournaments/lifecycle";
import { db } from "@/server/db";
import { findMyTeam, isRemovedFromTournament, isTokenShaped } from "@/server/join/join-view";
import { listTeamsWithCounts } from "@/server/teams/manage";
import {
  PUBLIC_PLAYER_SELECT,
  toPublicPlayer,
  type PublicPlayer,
} from "@/server/users/public-player";

/** Settings in force (S-23, S-24, S-25), realistic swim limits (S-93) and extra rules (S-26). */
const SETTINGS_SELECT = {
  fastestPaceSecPer100m: true,
  slowestPaceSecPer100m: true,
  longestRealisticSwimM: true,
  longestSwimCountedM: true,
  dailyLimitM: true,
  pointsPerKm: true,
  startChoiceDeadlineAt: true,
  swimTypeAllowed: true,
  submissionDays: true,
  lateUploadDays: true,
  firstSwimBonusPoints: true,
  longSwimTier1M: true,
  longSwimTier1Points: true,
  longSwimTier2M: true,
  longSwimTier2Points: true,
  multiplierTwoDaysPct: true,
  multiplierThreeDaysPct: true,
  streakStepPct: true,
  multiplierMaxPct: true,
  minSwimDistanceM: true,
  extraSlowestPaceSecPer100m: true,
} as const satisfies Prisma.TournamentSelect;

type Settings = Prisma.TournamentGetPayload<{ select: typeof SETTINGS_SELECT }>;
type Optional = "rulesText" | "rulesUrl" | "eligibilityNotes" | "contactChannel";

export type TournamentDetails = Pick<
  Tournament,
  "id" | "name" | "description" | "seasonStartAt" | "seasonEndAt" | "routeId" | "routeDistanceM"
> &
  Pick<Tournament, Optional | "bannerImageId" | "logoImageId"> & {
    organizer: PublicPlayer;
    status: TournamentStatus;
    teams: {
      id: string;
      name: string;
      emblemKey: string;
      description: string | null;
      memberLimit: number;
      memberCount: number;
      freePlaces: number;
    }[];
    settings: Settings;
    /** Joining is open and the viewer is not a member (nor removed after the start, S-41). */
    canJoin: boolean;
    /** Where "Join" goes when `canJoin`; the invite token only when the viewer brought it. */
    joinHref: string | null;
  };

const VISIBLE_WHEN_PUBLIC: TournamentStatus[] = ["PUBLISHED", "ACTIVE", "COMPLETED"];

/**
 * The tournament details page data (story S-28, FR-27). The viewer sees it when they organize
 * it, are an active member, it is public and published/active/completed, or they bring its
 * enabled invite token. A draft is for its organizer only. Anyone else gets `null`, exactly as
 * for a missing id, so the response never reveals that a tournament exists. The organizer is a
 * public player (never an email) and the invite token is never returned unless the viewer sent it.
 */
export async function getTournamentDetails(
  viewerId: string,
  id: string,
  { token }: { token?: unknown } = {},
  now: Date = new Date(),
): Promise<TournamentDetails | null> {
  if (typeof id !== "string" || id.length === 0) return null;
  const t = await db.tournament.findUnique({
    where: { id },
    include: { organizer: { select: PUBLIC_PLAYER_SELECT } },
  });
  if (!t) return null;

  const status = effectiveStatus(t, now);
  const isOrganizer = t.organizerId === viewerId;
  if (status === "DRAFT" && !isOrganizer) return null;

  const [myTeam, removed] = await Promise.all([
    findMyTeam(viewerId, t.id),
    isRemovedFromTournament(viewerId, t.id),
  ]);
  const validToken =
    isTokenShaped(token) && t.inviteEnabled && t.inviteToken !== null && token === t.inviteToken;
  const isPublic = t.visibility === "PUBLIC" && VISIBLE_WHEN_PUBLIC.includes(status);
  if (!isOrganizer && !myTeam && !isPublic && !validToken) return null;

  const canJoin = !myTeam && !removed && isJoiningOpen(t, now) && (isPublic || validToken);
  const joinHref = !canJoin
    ? null
    : validToken
      ? `/join/${encodeURIComponent(token)}`
      : `/tournaments/${t.id}/join`;

  const { teams } = await listTeamsWithCounts(t.id);
  const settings = Object.fromEntries(
    Object.keys(SETTINGS_SELECT).map((key) => [key, t[key as keyof Settings]]),
  ) as Settings;

  return {
    id: t.id,
    name: t.name,
    description: t.description,
    organizer: toPublicPlayer(t.organizer),
    status,
    seasonStartAt: t.seasonStartAt,
    seasonEndAt: t.seasonEndAt,
    routeId: t.routeId,
    routeDistanceM: t.routeDistanceM,
    teams: teams.map(({ id, name, emblemKey, description, memberLimit, memberCount }) => ({
      id,
      name,
      emblemKey,
      description,
      memberLimit,
      memberCount,
      freePlaces: Math.max(0, memberLimit - memberCount),
    })),
    settings,
    rulesText: t.rulesText,
    rulesUrl: t.rulesUrl,
    eligibilityNotes: t.eligibilityNotes,
    contactChannel: t.contactChannel,
    bannerImageId: t.bannerImageId,
    logoImageId: t.logoImageId,
    canJoin,
    joinHref,
  };
}
