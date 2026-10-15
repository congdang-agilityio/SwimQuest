import FitParser from "fit-file-parser";
import { ParseError, type ParsedSwim, type SwimType, type TrackPoint } from "./types";

const unreadable = (msg: string): never => {
  throw new ParseError("UNREADABLE_FILE", msg);
};

const positive = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;

const validDate = (v: unknown): Date | null =>
  v instanceof Date && !Number.isNaN(v.getTime()) ? v : null;

function swimType(subSport: string): SwimType {
  if (subSport === "lap_swimming") return "POOL";
  if (subSport === "open_water") return "OPEN_WATER";
  return "UNKNOWN";
}

export async function parseFit(buffer: Buffer): Promise<ParsedSwim> {
  let data;
  try {
    const bytes = new Uint8Array(buffer);
    data = await new FitParser().parseAsync(bytes.buffer as ArrayBuffer);
  } catch {
    return unreadable("Corrupt FIT file");
  }
  const session = data.sessions?.[0];
  if (!session) return unreadable("No session in FIT file");

  const startedAt = validDate(session.start_time);
  if (!startedAt) return unreadable("No start time");
  const durationS = Math.round(
    positive(session.total_timer_time) ?? positive(session.total_elapsed_time) ?? 0,
  );
  if (durationS <= 0) return unreadable("No activity duration");
  const distanceM = Math.round(positive(session.total_distance) ?? 0);
  if (distanceM <= 0) throw new ParseError("NO_DISTANCE", "File has no distance");

  const sport = String(session.sport ?? "unknown").toLowerCase();
  const subSport = String(session.sub_sport ?? "").toLowerCase();
  const isSwim = sport === "swimming";

  const track: TrackPoint[] = [];
  for (const r of data.records ?? []) {
    const { position_lat: lat, position_long: lon } = r;
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      track.push({ lat, lon, time: validDate(r.timestamp) });
    }
  }

  return {
    startedAt,
    endedAt: new Date(startedAt.getTime() + durationS * 1000),
    distanceM,
    durationS,
    swimType: isSwim ? swimType(subSport) : "UNKNOWN",
    sport: subSport && subSport !== "generic" ? subSport : sport,
    isSwim,
    track,
  };
}
