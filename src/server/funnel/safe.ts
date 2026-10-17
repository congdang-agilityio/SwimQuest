import { db } from "@/server/db";
import { recordFunnelEvent, type FunnelEventName, type FunnelOptions } from "./record";

/**
 * Records a funnel event outside a transaction (page renders, routes after the action has
 * committed). A failure is logged and swallowed, so a page or an API answer never breaks
 * because of analytics.
 */
export async function recordFunnelEventSafe(
  name: FunnelEventName,
  options: FunnelOptions = {},
): Promise<void> {
  try {
    await recordFunnelEvent(db, name, options);
  } catch (error) {
    console.error("funnel: event not recorded", name, error);
  }
}
