import type { NotificationCategory } from "@prisma/client";

/** Push categories in the order Profile > Notifications lists them (S-68). */
export const PUSH_CATEGORIES = [
  "INVITATIONS",
  "TEAM",
  "VERIFICATION",
  "MILESTONES",
] as const satisfies readonly NotificationCategory[];

export type PushCategory = (typeof PUSH_CATEGORIES)[number];

/** Push on (true) or off (false) per category; every category is on by default. */
export type PushPreferences = Record<PushCategory, boolean>;
