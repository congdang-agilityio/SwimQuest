import { GOAL_DISTANCE_MAX_M } from "@/lib/validation/profile";
import { formatKm, normalizeDecimal } from "@/lib/decimal-km";

/**
 * Reads a typed goal distance such as "800 m" or "2,5 km" into whole metres. The unit is part of
 * the text, so there is no unit picker. Returns null for anything else (the server stays the
 * source of truth for the limits, this only avoids sending text it cannot read).
 */
export function parseGoalDistance(text: string): number | null {
  const match = /^\s*([\d.,]+)\s*(m|km)\s*$/i.exec(text);
  if (!match) return null;
  const value = Number(normalizeDecimal(match[1]));
  if (!Number.isFinite(value)) return null;
  const metres = Math.round(match[2].toLowerCase() === "km" ? value * 1000 : value);
  return metres >= 1 && metres <= GOAL_DISTANCE_MAX_M ? metres : null;
}

/** Whole metres as the text the edit field shows: "800 m" under a kilometre, else "2,5 km". */
export function goalDistanceText(metres: number | null, locale: string): string {
  if (!metres) return "";
  return metres < 1000 ? `${metres} m` : `${formatKm(metres, locale)} km`;
}
