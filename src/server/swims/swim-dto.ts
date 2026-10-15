import type { Prisma, Swim, SwimResult } from "@prisma/client";
import { utcToVnParts } from "@/lib/time/vn";

/** Prisma `include` that loads what the DTO shows of each per-tournament result. */
export const swimDtoInclude = {
  results: {
    select: {
      tournamentId: true,
      status: true,
      reasons: true,
      tournament: {
        select: {
          name: true,
          seasonStartAt: true,
          seasonEndAt: true,
          fastestPaceSecPer100m: true,
          slowestPaceSecPer100m: true,
          longestRealisticSwimM: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.SwimInclude;

type ResultForDto = Pick<SwimResult, "tournamentId" | "status"> & {
  reasons: unknown;
  tournament: {
    name: string;
    seasonStartAt: Date;
    seasonEndAt: Date;
    fastestPaceSecPer100m: number;
    slowestPaceSecPer100m: number;
    longestRealisticSwimM: number;
  };
};
export type SwimForDto = Swim & { results?: ResultForDto[] };

/** The tournament limits a reason refers to, so the UI can say what the limit was. */
export type ResultRulesDto = {
  /** UTC instants (ISO 8601). */
  seasonStartAt: string;
  seasonEndAt: string;
  fastestPaceS: number;
  slowestPaceS: number;
  longestSwimM: number;
};

/** The swim's outcome in one tournament; `reasons` are codes the UI turns into words. */
export type SwimResultDto = {
  tournamentId: string;
  tournamentName: string;
  status: SwimResult["status"];
  reasons: string[];
  rules: ResultRulesDto;
};

/** What the owner sees of a swim: never the track, the file hash or raw points. */
export type OwnerSwimDto = {
  id: string;
  source: Swim["source"];
  /** UTC instant (ISO 8601). */
  startedAt: string;
  /** Vietnam local date (YYYY-MM-DD) and start time (HH:mm). */
  date: string;
  startTime: string;
  distanceM: number;
  durationS: number;
  /** Seconds per 100 m, rounded; null when the distance is 0. */
  pacePer100mS: number | null;
  swimType: Swim["swimType"];
  isSwim: boolean;
  isDuplicate: boolean;
  results: SwimResultDto[];
};

function toResultDto(r: ResultForDto): SwimResultDto {
  const reasons = Array.isArray(r.reasons)
    ? r.reasons.filter((x): x is string => typeof x === "string")
    : [];
  return {
    tournamentId: r.tournamentId,
    tournamentName: r.tournament.name,
    status: r.status,
    reasons,
    rules: {
      seasonStartAt: r.tournament.seasonStartAt.toISOString(),
      seasonEndAt: r.tournament.seasonEndAt.toISOString(),
      fastestPaceS: r.tournament.fastestPaceSecPer100m,
      slowestPaceS: r.tournament.slowestPaceSecPer100m,
      longestSwimM: r.tournament.longestRealisticSwimM,
    },
  };
}

export function toOwnerSwimDto(swim: SwimForDto): OwnerSwimDto {
  const { date, time } = utcToVnParts(swim.startedAt);
  return {
    id: swim.id,
    source: swim.source,
    startedAt: swim.startedAt.toISOString(),
    date,
    startTime: time,
    distanceM: swim.distanceM,
    durationS: swim.durationS,
    pacePer100mS: swim.distanceM > 0 ? Math.round(swim.durationS / (swim.distanceM / 100)) : null,
    swimType: swim.swimType,
    isSwim: swim.isSwim,
    isDuplicate: swim.duplicateOfId !== null,
    results: (swim.results ?? []).map(toResultDto),
  };
}
