import type { Swim } from "@prisma/client";
import { utcToVnParts } from "@/lib/time/vn";

export type SwimForDto = Swim;

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
};

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
  };
}
