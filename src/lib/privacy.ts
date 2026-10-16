/**
 * Profile privacy (FR-16, story S-56). Each profile part has a level; email has no setting and
 * is only ever visible to the player themself. "Members only" means signed-in players who share
 * a tournament with the player; teammates count as members.
 */
export const PRIVACY_LEVELS = ["PUBLIC", "MEMBERS", "PRIVATE"] as const;
export type PrivacyLevel = (typeof PRIVACY_LEVELS)[number];

// prettier-ignore
export const PRIVACY_FIELDS = [
  "displayName", "avatar", "bio", "region", "goals", "stats", "badges",
] as const;
export type PrivacyField = (typeof PRIVACY_FIELDS)[number];
export type PrivacySettings = Record<PrivacyField, PrivacyLevel>;

/** How the viewer relates to the profile owner. */
export type Relation = "SELF" | "TEAMMATE" | "SHARES_TOURNAMENT" | "OTHER";

/** `avatar` covers the avatar and the cover image. */
export const PRIVACY_DEFAULTS: Readonly<PrivacySettings> = Object.freeze({
  displayName: "PUBLIC",
  avatar: "PUBLIC",
  bio: "MEMBERS",
  region: "MEMBERS",
  goals: "MEMBERS",
  stats: "MEMBERS",
  badges: "MEMBERS",
});

const VISIBLE_TO: Record<PrivacyLevel, readonly Relation[]> = {
  PUBLIC: ["SELF", "TEAMMATE", "SHARES_TOURNAMENT", "OTHER"],
  MEMBERS: ["SELF", "TEAMMATE", "SHARES_TOURNAMENT"],
  PRIVATE: ["SELF"],
};

/** Whether a viewer with `relation` may see a part at `level`. Unknown values hide. */
export function canSee(level: PrivacyLevel, relation: Relation): boolean {
  return Object.hasOwn(VISIBLE_TO, level) && VISIBLE_TO[level].includes(relation);
}

/** Whether a viewer may see `field` of a profile with `settings`; email is always private. */
export function canSeeField(
  settings: PrivacySettings,
  field: PrivacyField | "email",
  relation: Relation,
): boolean {
  if (field === "email") return relation === "SELF";
  return canSee(settings[field] ?? PRIVACY_DEFAULTS[field], relation);
}

/** Stored `User.privacy` JSON → full settings: defaults filled in, unknown keys and levels dropped. */
export function resolvePrivacy(stored: unknown): PrivacySettings {
  const settings: PrivacySettings = { ...PRIVACY_DEFAULTS };
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) return settings;
  const record = stored as Record<string, unknown>;
  for (const field of PRIVACY_FIELDS) {
    const level = record[field];
    if (PRIVACY_LEVELS.includes(level as PrivacyLevel)) settings[field] = level as PrivacyLevel;
  }
  return settings;
}
