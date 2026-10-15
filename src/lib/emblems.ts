export const EMBLEM_KEYS = ["turtle", "dolphin", "wave", "anchor", "shell", "star"] as const;

export type EmblemKey = (typeof EMBLEM_KEYS)[number];

export function isEmblemKey(value: unknown): value is EmblemKey {
  return typeof value === "string" && (EMBLEM_KEYS as readonly string[]).includes(value);
}

export function emblemPath(key: EmblemKey): string {
  return `/art/emblems/${key}.svg`;
}
