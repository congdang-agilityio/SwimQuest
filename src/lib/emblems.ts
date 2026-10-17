import { mockupArt } from "@/lib/art/mockup-art";
import { MOCKUP_TEAM_EMBLEM } from "@/lib/art/mockup-avatars";

export const EMBLEM_KEYS = [
  "turtle",
  "dolphin",
  "wave",
  "anchor",
  "shell",
  "star",
  "lighthouse",
  "fish",
] as const;

export type EmblemKey = (typeof EMBLEM_KEYS)[number];

/** Art for each emblem, cut from the stakeholder asset sheets (registry keys, G2/G3). */
const EMBLEM_ART: Record<Exclude<EmblemKey, "wave">, string> = {
  turtle: "marine/sea-turtle",
  dolphin: "marine/dolphin",
  anchor: "badges/badge-coin-anchor",
  shell: "items/seashell",
  star: "items/star",
  lighthouse: "badges/badge-shield-lighthouse",
  fish: "marine/clownfish",
};

export function isEmblemKey(value: unknown): value is EmblemKey {
  return typeof value === "string" && (EMBLEM_KEYS as readonly string[]).includes(value);
}

/**
 * Image of an emblem. "wave" is the mockup team's swirl logo; the others come from the art
 * registry. The earlier vector stand-in is used when the registry is empty (unit tests).
 */
export function emblemPath(key: EmblemKey): string {
  if (key === "wave") return MOCKUP_TEAM_EMBLEM;
  return mockupArt(EMBLEM_ART[key])?.webp ?? `/art/emblems/${key}.svg`;
}
