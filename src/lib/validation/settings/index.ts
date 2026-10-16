import type { z } from "zod";
import { deadlinesSettingsSchema } from "./deadlines";
import { extraRulesSettingsSchema } from "./extra-rules";
import { POINTS_COLUMNS, pointsSettingsSchema } from "./points";
import { realisticLimitsSettingsSchema } from "./realistic-limits";
import { swimSettingsSchema } from "./swim";
import { visibilitySettingsSchema } from "./visibility";

/**
 * Tournament settings groups (S-23 to S-26, S-93). The organizer saves one group at a time:
 * `schema` turns the form input into stored columns, `columns` lists them for reading, and a
 * `seasonLocked` group cannot change once the season has started (fairness, S-32).
 */
export type SettingsGroup = {
  schema: z.ZodType<Record<string, unknown>, unknown>;
  columns: readonly string[];
  seasonLocked: boolean;
  /** Stricter schema that needs the tournament (used by the save when present). */
  schemaFor?: (tournament: {
    seasonStartAt: Date;
    slowestPaceSecPer100m: number;
    longestRealisticSwimM: number;
    swimLimitBounds: unknown;
    extraSlowestPaceSecPer100m: number | null;
  }) => z.ZodType<Record<string, unknown>, unknown>;
};

export const SETTINGS_GROUPS = {
  swim: {
    schema: swimSettingsSchema,
    columns: ["longestSwimCountedM", "dailyLimitM", "swimTypeAllowed"],
    seasonLocked: true,
  },
  deadlines: {
    schema: deadlinesSettingsSchema(),
    schemaFor: (t) => deadlinesSettingsSchema(t.seasonStartAt),
    columns: ["submissionDays", "lateUploadDays", "startChoiceDeadlineAt"],
    seasonLocked: true,
  },
  extraRules: {
    schema: extraRulesSettingsSchema({ slowestPaceSecPer100m: 300, longestRealisticSwimM: 30000 }),
    schemaFor: (t) => extraRulesSettingsSchema(t),
    columns: ["minSwimDistanceM", "extraSlowestPaceSecPer100m"],
    seasonLocked: true,
  },
  realisticLimits: {
    schema: realisticLimitsSettingsSchema({
      swimLimitBounds: null,
      extraSlowestPaceSecPer100m: null,
    }),
    schemaFor: (t) => realisticLimitsSettingsSchema(t),
    columns: ["fastestPaceSecPer100m", "slowestPaceSecPer100m", "longestRealisticSwimM"],
    seasonLocked: true,
  },
  points: { schema: pointsSettingsSchema, columns: POINTS_COLUMNS, seasonLocked: true },
  // Not season configuration (FR-24): editable at any time, even while the season is active.
  visibility: {
    schema: visibilitySettingsSchema,
    columns: ["visibility"],
    seasonLocked: false,
  },
} as const satisfies Record<string, SettingsGroup>;

export type SettingsGroupName = keyof typeof SETTINGS_GROUPS;

export const isSettingsGroup = (group: unknown): group is SettingsGroupName =>
  typeof group === "string" && Object.hasOwn(SETTINGS_GROUPS, group);
