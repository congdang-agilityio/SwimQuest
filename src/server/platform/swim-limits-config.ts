import { z } from "zod";
import {
  STARTING_SWIM_LIMIT_CONFIG,
  validateLimitConfig,
  type LimitConfigErrors,
  type SwimLimitConfig,
} from "@/lib/swim-limits";
import { db } from "@/server/db";
import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/record";
import { requirePlatformAdmin } from "@/server/auth/roles";
import type { AdminActor } from "@/server/admin/users";
import { getSetting, lockSetting, setSetting } from "./settings";

export const SWIM_LIMITS_SETTING_KEY = "swimLimits";

/** Refused config or missing reason; `fieldErrors` says what to fix (S-64 AC 4). */
export class SwimLimitConfigError extends Error {
  readonly status = 400;
  readonly code = "INVALID_LIMIT_CONFIG";
  constructor(readonly fieldErrors: LimitConfigErrors) {
    super("INVALID_LIMIT_CONFIG");
  }
}

const reasonSchema = z.string().trim().min(1).max(500);

async function readConfig(client: Parameters<typeof getSetting>[2]): Promise<SwimLimitConfig> {
  const stored = await getSetting(SWIM_LIMITS_SETTING_KEY, null, client);
  const parsed = stored === null ? null : validateLimitConfig(stored);
  return parsed?.ok ? parsed.config : STARTING_SWIM_LIMIT_CONFIG;
}

/** Default realistic swim limits and sanity bounds (S-64 AC 1); starting values if none saved. */
export async function getSwimLimitConfig(): Promise<SwimLimitConfig> {
  return readConfig(db);
}

/**
 * Saves defaults and bounds (S-64 AC 2-5) for an active platform admin (role re-read from the
 * database), audited as `SWIM_LIMITS_CHANGED` with old and new config and the reason, in one
 * transaction. `ForbiddenError` / `SwimLimitConfigError` save nothing.
 */
export async function setSwimLimitConfig(
  actor: AdminActor,
  input: unknown,
  reason: string,
): Promise<SwimLimitConfig> {
  return db.$transaction(async (tx) => {
    const id = typeof actor?.id === "string" ? actor.id : "";
    const user = id ? await tx.user.findUnique({ where: { id } }) : null;
    requirePlatformAdmin(user?.status === "ACTIVE" ? user : null);
    const checked = validateLimitConfig(input);
    const why = reasonSchema.safeParse(reason);
    const errors = checked.ok ? {} : checked.errors;
    if (!why.success) errors.reason = "REQUIRED";
    if (!checked.ok || !why.success) throw new SwimLimitConfigError(errors);
    await lockSetting(tx, SWIM_LIMITS_SETTING_KEY);
    const before = await readConfig(tx);
    await setSetting(tx, SWIM_LIMITS_SETTING_KEY, checked.config, id);
    await recordAudit(tx, {
      actor: { type: "USER", userId: id },
      action: AUDIT_ACTIONS.SWIM_LIMITS_CHANGED,
      entityType: "PlatformSetting",
      entityId: SWIM_LIMITS_SETTING_KEY,
      before,
      after: checked.config,
      reason: why.data,
    });
    return checked.config;
  });
}
