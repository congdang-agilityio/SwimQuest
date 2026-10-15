import type { OwnerSwimDto } from "@/server/swims/swim-dto";

type SwimLocale = "vi" | "en";
type Status = "duplicate" | "notSwim" | "counted" | "flagged" | "notCounted" | "saved";

const pad = (n: number) => String(n).padStart(2, "0");

/** Metres below 1 km ("850 m"), kilometres with up to 2 decimals otherwise ("1,25 km"). */
export function formatDistance(metres: number, locale: SwimLocale = "vi"): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  const km = (Math.round(metres / 10) / 100).toString();
  return `${locale === "vi" ? km.replace(".", ",") : km} km`;
}

/** "m:ss" below one hour, "h:mm:ss" otherwise. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const [h, m] = [Math.floor(s / 3600), Math.floor((s % 3600) / 60)];
  return `${h ? `${h}:${pad(m)}` : m}:${pad(s % 60)}`;
}
export function formatPace(secondsPer100m: number | null): string {
  return secondsPer100m === null ? "-" : `${formatDuration(secondsPer100m)} /100 m`;
}
export function formatVnDateTime(date: string, time: string): string {
  const [y, m, d] = date.split("-");
  return `${time} ${d}/${m}/${y}`;
}

/** One status for the swim, from the facts and its per-tournament results. */
export function swimStatus(swim: Pick<OwnerSwimDto, "isDuplicate" | "isSwim" | "results">): Status {
  if (swim.isDuplicate) return "duplicate";
  if (!swim.isSwim) return "notSwim";
  const has = (s: string) => swim.results.some((r) => r.status === s);
  if (has("VERIFIED")) return "counted";
  return has("FLAGGED") ? "flagged" : swim.results.length ? "notCounted" : "saved";
}
