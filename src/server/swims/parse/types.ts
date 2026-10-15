export type SwimType = "POOL" | "OPEN_WATER" | "UNKNOWN";

export interface TrackPoint {
  lat: number;
  lon: number;
  time: Date | null;
}

export interface ParsedSwim {
  startedAt: Date;
  endedAt: Date;
  /** Whole metres. */
  distanceM: number;
  durationS: number;
  swimType: SwimType;
  /** Raw sport label from the file (lower case), or "unknown". */
  sport: string;
  isSwim: boolean;
  track: TrackPoint[];
}

export type ParseErrorCode = "UNREADABLE_FILE" | "NO_DISTANCE";

export class ParseError extends Error {
  readonly code: ParseErrorCode;
  constructor(code: ParseErrorCode, message?: string) {
    super(message ?? code);
    this.name = "ParseError";
    this.code = code;
  }
}
