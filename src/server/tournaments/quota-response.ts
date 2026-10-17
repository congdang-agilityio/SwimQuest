import type { NextResponse } from "next/server";
import { apiError } from "@/server/http/api-error";
import { QuotaError } from "./quota";

/** The response for a refused quota action (409 conflicts, 400 bad input), or null. */
export function quotaErrorResponse(err: unknown): NextResponse | null {
  return err instanceof QuotaError ? apiError(err.status, err.code) : null;
}
