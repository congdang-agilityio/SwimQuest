import { XMLParser, XMLValidator } from "fast-xml-parser";
import { ParseError, type ParsedSwim, type SwimType, type TrackPoint } from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  processEntities: false,
  parseTagValue: false,
  isArray: (name) => ["trk", "trkseg", "trkpt"].includes(name),
});

type Node = Record<string, unknown>;
const isNode = (v: unknown): v is Node => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: unknown): Node[] => (Array.isArray(v) ? v.filter(isNode) : []);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const unreadable = (msg: string): never => {
  throw new ParseError("UNREADABLE_FILE", msg);
};

/** First non-empty value under a key named one of `names` (lower case), at any depth. */
function findDeep(node: unknown, names: string[], depth = 0): string {
  if (depth > 8 || typeof node !== "object" || node === null) return "";
  const entries = Object.entries(node);
  const own = entries.find(([k, v]) => names.includes(k.toLowerCase()) && str(v));
  if (own) return str(own[1]);
  for (const [, v] of entries) {
    const hit = findDeep(v, names, depth + 1);
    if (hit) return hit;
  }
  return "";
}

function date(v: unknown): Date | null {
  const d = new Date(str(v));
  return str(v) && !Number.isNaN(d.getTime()) ? d : null;
}

function positive(v: string): number | null {
  return Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null;
}

function haversineM(a: TrackPoint, b: TrackPoint): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

function swimType(sport: string): SwimType {
  if (/open|\bow\b|sea|ocean|lake|river/.test(sport.replace(/_/g, " "))) return "OPEN_WATER";
  return /lap|pool/.test(sport) ? "POOL" : "UNKNOWN";
}

function readPoints(trks: Node[]): TrackPoint[] {
  const points: TrackPoint[] = [];
  for (const seg of trks.flatMap((t) => arr(t.trkseg))) {
    for (const p of arr(seg.trkpt)) {
      const latRaw = str(p["@_lat"]);
      const lonRaw = str(p["@_lon"]);
      if (!latRaw || !lonRaw) continue;
      const lat = Number(latRaw);
      const lon = Number(lonRaw);
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180)
        points.push({ lat, lon, time: date(p.time) });
    }
  }
  return points;
}

export function parseGpx(buffer: Buffer): ParsedSwim {
  const xml = buffer.toString("utf8");
  if (!xml.trim() || xml.includes("\u0000") || xml.includes("�")) unreadable("Not a text file");
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) unreadable("DOCTYPE and entities are not allowed");
  if (XMLValidator.validate(xml) !== true) unreadable("Malformed XML");
  const root = (parser.parse(xml) as Node).gpx;
  if (!isNode(root)) return unreadable("Not a GPX file");

  const trks = arr(root.trk);
  if (trks.length === 0) unreadable("No activity data");
  const track = readPoints(trks);
  const times = track.flatMap((p) => (p.time ? [p.time] : []));
  const startedAt = times[0] ?? (isNode(root.metadata) ? date(root.metadata.time) : null);
  if (!startedAt) return unreadable("No timestamps");

  let distance = positive(findDeep(root, ["distance", "totaldistance", "totaldistancemeters"]));
  if (distance === null && track.length >= 2) {
    distance = track.slice(1).reduce((sum, p, i) => sum + haversineM(track[i]!, p), 0);
  }
  if (distance === null || Math.round(distance) <= 0) {
    throw new ParseError("NO_DISTANCE", "File has no distance");
  }

  const total = positive(findDeep(root, ["totaltime", "totaltimeseconds", "duration"]));
  const last = times[times.length - 1]!;
  const durationS =
    total !== null
      ? Math.round(total)
      : times.length >= 2
        ? Math.round((last.getTime() - startedAt.getTime()) / 1000)
        : 0;
  if (durationS <= 0) unreadable("No activity duration");
  const endedAt = total !== null ? new Date(startedAt.getTime() + durationS * 1000) : last;

  const sport = (
    str(trks.map((t) => str(t.type)).find(Boolean)) ||
    findDeep(root, ["sport", "activity", "activitytype"]) ||
    "unknown"
  ).toLowerCase();
  const isSwim = sport.includes("swim");
  return {
    startedAt,
    endedAt,
    distanceM: Math.round(distance),
    durationS,
    swimType: isSwim ? swimType(sport) : "UNKNOWN",
    sport,
    isSwim,
    track,
  };
}
