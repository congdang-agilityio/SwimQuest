import { mockupArt } from "@/lib/art/mockup-art";

const BADGE_ART: Record<string, string> = {
  PARTICIPATION: "badges/badge-participation",
  EXPLORER: "badges/badge-explorer",
  PERSEVERANCE: "badges/badge-persistence",
  TEAMWORK: "badges/badge-teamwork",
  CONQUEROR: "badges/badge-conqueror",
  SEASON: "badges/badge-season",
  SPECIAL: "badges/badge-legend",
  LY_SON: "badges/badge-shield-lighthouse",
};

/** The G2 badge art for a badge kind (unknown kinds fall back to Participation). */
export function badgeArt(kind: string) {
  return mockupArt(BADGE_ART[kind] ?? "badges/badge-participation");
}
