import type { z } from "zod";
import { swimSettingsSchema } from "./swim";

/**
 * Tournament settings groups (S-23 to S-26, S-93). The organizer saves one group at a time:
 * `schema` turns the form input into stored columns, `columns` lists them for reading, and a
 * `seasonLocked` group cannot change once the season has started (fairness, S-32).
 */
export type SettingsGroup = {
  schema: z.ZodType<Record<string, unknown>, unknown>;
  columns: readonly string[];
  seasonLocked: boolean;
};

export const SETTINGS_GROUPS = {
  swim: {
    schema: swimSettingsSchema,
    columns: ["longestSwimCountedM", "dailyLimitM", "swimTypeAllowed"],
    seasonLocked: true,
  },
} as const satisfies Record<string, SettingsGroup>;

export type SettingsGroupName = keyof typeof SETTINGS_GROUPS;

export const isSettingsGroup = (group: unknown): group is SettingsGroupName =>
  typeof group === "string" && Object.hasOwn(SETTINGS_GROUPS, group);
