import type { SwimResultStatus } from "@prisma/client";

/** Fields shared by team-scoped events. Ids only: never emails, names or GPS tracks. */
type TeamEvent = { tournamentId: string; teamId: string };
type MemberEvent = TeamEvent & { userId: string };

/** Every domain event of release 1, keyed by type, with its payload. */
export type DomainEventMap = {
  SWIM_RESULT_CHANGED: MemberEvent & {
    resultId: string;
    swimId: string;
    status: SwimResultStatus;
    previousStatus: SwimResultStatus | null;
  };
  TEAM_CREATED: TeamEvent & { createdBy: string };
  TEAM_JOINED: MemberEvent;
  PLAYER_ADDED_TO_TEAM: MemberEvent & { addedBy: string };
  TEAM_MEMBER_LEFT: MemberEvent;
  TEAM_MEMBER_MOVED: MemberEvent & { fromTeamId: string };
  TEAM_MEMBER_REMOVED: MemberEvent & { removedBy: string };
  TEAM_CAPTAIN_SET: MemberEvent & { setBy: string };
  TEAM_START_SET: TeamEvent & { startId: string; setBy: string };
  TEAM_START_LOCKED: TeamEvent & { startId: string };
  TEAM_PROGRESS_CHANGED: TeamEvent & { fromBp: number; toBp: number };
  TEAM_FINISHED: TeamEvent;
  TEAM_FINISH_LOST: TeamEvent;
  BADGE_AWARDED: { tournamentId?: string; userId: string; badgeKey: string };
  BADGE_REMOVED: { tournamentId?: string; userId: string; badgeKey: string };
  LEVEL_CHANGED: { userId: string; fromLevel: number; toLevel: number };
  SEASON_STARTED: { tournamentId: string };
  SEASON_ENDED: { tournamentId: string };
};

export type DomainEventType = keyof DomainEventMap;

/** A typed event: `{ type, payload }` for exactly one of the known types. */
export type DomainEventInput = {
  [T in DomainEventType]: { type: T; payload: DomainEventMap[T] };
}[DomainEventType];
