export type SwimType = "POOL" | "OPEN_WATER" | "UNKNOWN";
export type TrackPoint = { lat: number; lon: number; time: Date | null };

/** distanceM is in whole metres; sport is the lower-case label from the file. */
export interface ParsedSwim {
  startedAt: Date;
  endedAt: Date;
  distanceM: number;
  durationS: number;
  swimType: SwimType;
  sport: string;
  isSwim: boolean;
  track: TrackPoint[];
}

export class ParseError extends Error {
  constructor(
    readonly code: "UNREADABLE_FILE" | "NO_DISTANCE" | "UNSUPPORTED_FILE",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ParseError";
  }
}
