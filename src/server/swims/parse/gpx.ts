import { XMLParser, XMLValidator } from "fast-xml-parser";
import { ParseError, type ParsedSwim, type SwimType, type TrackPoint } from "./types";

const EARTH_RADIUS_M = 6_371_000;
const MAX_BYTES = 20 * 1024 * 1024;
const ARRAYS = new Set(["trk", "trkseg", "trkpt"]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  processEntities: false,
  parseTagValue: false,
  parseAttributeValue: false,
  isArray: (name) => ARRAYS.has(name),
});

type Node = Record<string, unknown>;
const isNode = (v: unknown): v is Node => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown): string | null =>
  typeof v === "string" || typeof v === "number" ? String(v).trim() : null;

function unreadable(msg: string): never {
  throw new ParseError("UNREADABLE_FILE", msg);
}

/** First value under any key named `names` (lower case) at any depth. */
function findDeep(node: unknown, names: string[], depth = 0): string | null {
  if (depth > 8) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = findDeep(item, names, depth + 1);
      if (hit !== null) return hit;
    }
    return null;
  }
  if (!isNode(node)) return null;
  for (const [key, value] of Object.entries(node)) {
    if (names.includes(key.toLowerCase())) {
      const t = text(value);
      if (t) return t;
    }
  }
  for (const value of Object.values(node)) {
    const hit = findDeep(value, names, depth + 1);
    if (hit !== null) return hit;
  }
  return null;
}

function parseDate(v: unknown): Date | null {
  const t = text(v);
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

function positive(v: string | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function haversineM(a: TrackPoint, b: TrackPoint): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

function classify(sport: string): { isSwim: boolean; swimType: SwimType } {
  const s = sport.toLowerCase();
  const isSwim = s.includes("swim");
  if (!isSwim) return { isSwim, swimType: "UNKNOWN" };
  if (/open|\bow\b|sea|ocean|lake|river/.test(s.replace(/_/g, " "))) {
    return { isSwim, swimType: "OPEN_WATER" };
  }
  if (/lap|pool/.test(s)) return { isSwim, swimType: "POOL" };
  return { isSwim, swimType: "UNKNOWN" };
}

function readPoints(trk: Node[]): TrackPoint[] {
  const points: TrackPoint[] = [];
  for (const t of trk) {
    const segs = Array.isArray(t.trkseg) ? t.trkseg : [];
    for (const seg of segs) {
      const pts = isNode(seg) && Array.isArray(seg.trkpt) ? seg.trkpt : [];
      for (const p of pts) {
        if (!isNode(p)) continue;
        const lat = Number(p["@_lat"]);
        const lon = Number(p["@_lon"]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
        points.push({ lat, lon, time: parseDate(p.time) });
      }
    }
  }
  return points;
}

export function parseGpx(buffer: Buffer): ParsedSwim {
  if (buffer.length === 0 || buffer.length > MAX_BYTES) unreadable("Empty or oversized file");
  const xml = buffer.toString("utf8");
  if (xml.includes("\u0000") || xml.includes("�")) unreadable("Not a text file");
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) unreadable("DOCTYPE and entities are not allowed");
  if (XMLValidator.validate(xml) !== true) unreadable("Malformed XML");

  let root: unknown;
  try {
    root = (parser.parse(xml) as Node).gpx;
  } catch {
    unreadable("Malformed XML");
  }
  if (!isNode(root)) unreadable("Not a GPX file");

  const trks = (Array.isArray(root.trk) ? root.trk : []).filter(isNode);
  const track = readPoints(trks);
  const times = track.map((p) => p.time).filter((t): t is Date => t !== null);
  const metaTime = isNode(root.metadata) ? parseDate(root.metadata.time) : null;

  const startedAt = times[0] ?? metaTime;
  if (!startedAt) unreadable("No timestamps");

  let distance = positive(
    findDeep(root, ["distance", "totaldistance", "totaldistancemeters", "distancemeters"]),
  );
  if (distance === null && track.length >= 2) {
    distance = 0;
    for (let i = 1; i < track.length; i++) distance += haversineM(track[i - 1]!, track[i]!);
  }
  if (distance === null) throw new ParseError("NO_DISTANCE", "File has no distance");
  const distanceM = Math.round(distance);

  const totalTime = positive(
    findDeep(root, ["totaltime", "totaltimeseconds", "totalelapsedtime", "duration"]),
  );
  let endedAt: Date;
  let durationS: number;
  if (totalTime !== null) {
    durationS = Math.round(totalTime);
    endedAt = new Date(startedAt.getTime() + durationS * 1000);
  } else if (times.length >= 2) {
    endedAt = times[times.length - 1]!;
    durationS = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);
  } else {
    unreadable("No activity duration");
  }
  if (durationS <= 0) unreadable("Non-positive duration");

  const sportRaw =
    text(trks.map((t) => text(t.type)).find(Boolean)) ??
    findDeep(root, ["sport", "activity", "activitytype"]);
  const sport = sportRaw ? sportRaw.toLowerCase() : "unknown";
  const { isSwim, swimType } = classify(sport);

  return { startedAt, endedAt, distanceM, durationS, swimType, sport, isSwim, track };
}
