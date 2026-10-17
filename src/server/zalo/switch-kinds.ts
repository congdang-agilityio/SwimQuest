import type { Prisma, ZaloMessageKind } from "@prisma/client";
import { z } from "zod";

/** The seven message switches (S-89 AC 1); the introduction has none and always goes out. */
export const ZALO_SWITCH_KEYS = [
  "newTeam",
  "playerJoined",
  "playerMoved",
  "seasonStart",
  "countedSwims",
  "milestones",
  "seasonEnd",
] as const;

export type ZaloSwitchKey = (typeof ZALO_SWITCH_KEYS)[number];
export type ZaloSwitches = Record<ZaloSwitchKey, boolean>;

export type SwitchColumn =
  | "notifyNewTeam"
  | "notifyPlayerJoined"
  | "notifyPlayerMoved"
  | "notifySeasonStart"
  | "notifyCountedSwims"
  | "notifyMilestones"
  | "notifySeasonEnd";

const COLUMN: Record<ZaloSwitchKey, SwitchColumn> = {
  newTeam: "notifyNewTeam",
  playerJoined: "notifyPlayerJoined",
  playerMoved: "notifyPlayerMoved",
  seasonStart: "notifySeasonStart",
  countedSwims: "notifyCountedSwims",
  milestones: "notifyMilestones",
  seasonEnd: "notifySeasonEnd",
};

/** The `TournamentZalo` column that switches each message kind; the introduction has none. */
export const SWITCH_FOR_KIND: Record<ZaloMessageKind, SwitchColumn | null> = {
  INTRO: null,
  NEW_TEAM: "notifyNewTeam",
  PLAYER_JOINED: "notifyPlayerJoined",
  PLAYER_MOVED: "notifyPlayerMoved",
  SEASON_START: "notifySeasonStart",
  COUNTED_SWIM: "notifyCountedSwims",
  MILESTONE: "notifyMilestones",
  SEASON_END: "notifySeasonEnd",
};

export const ZALO_SWITCH_SELECT = {
  notifyNewTeam: true,
  notifyPlayerJoined: true,
  notifyPlayerMoved: true,
  notifySeasonStart: true,
  notifyCountedSwims: true,
  notifyMilestones: true,
  notifySeasonEnd: true,
} satisfies Prisma.TournamentZaloSelect;

/** `PATCH { switches }`: at least one switch, booleans only, no unknown keys. */
export const ZaloSwitchesPatch = z
  .object(
    Object.fromEntries(ZALO_SWITCH_KEYS.map((k) => [k, z.boolean().optional()])) as Record<
      ZaloSwitchKey,
      z.ZodOptional<z.ZodBoolean>
    >,
  )
  .strict()
  .refine((v) => Object.values(v).some((x) => x !== undefined));

export function switchColumn(key: ZaloSwitchKey): SwitchColumn {
  return COLUMN[key];
}

export function switchesOf(row: Record<SwitchColumn, boolean>): ZaloSwitches {
  return Object.fromEntries(ZALO_SWITCH_KEYS.map((k) => [k, row[COLUMN[k]]])) as ZaloSwitches;
}
