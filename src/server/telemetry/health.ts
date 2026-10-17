import type { HealthSignalKind } from "@prisma/client";
import { db } from "@/server/db";

const MAX_PATH = 200;

/** The path part only: no query string or hash, at most 200 characters. */
export function cleanSignalPath(path: string): string {
  return path.split(/[?#]/, 1)[0].slice(0, MAX_PATH);
}

/**
 * Counts one failed API call or asset load (S-83 AC 4). Stores the kind, a path without query
 * string and an optional HTTP status: no user, IP or user agent. It never throws, so reporting
 * can never break the page or the API answer that triggered it.
 */
export async function recordHealthSignal(
  kind: HealthSignalKind,
  path: string,
  status?: number,
): Promise<void> {
  try {
    await db.healthSignal.create({
      data: { kind, path: cleanSignalPath(path), ...(status ? { status } : {}) },
    });
  } catch (error) {
    console.error("telemetry: health signal not recorded", error);
  }
}
