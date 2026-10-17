import { FORBIDDEN_DIGEST } from "@/lib/http/forbidden-digest";
import { ForbiddenError } from "@/server/auth/roles";

/**
 * Pages call this in a `catch`: a `ForbiddenError` is rethrown so the app error boundary renders
 * access denied; any other error is rethrown unchanged.
 */
export function rethrowForbidden(err: unknown): never {
  if (err instanceof ForbiddenError) {
    throw Object.assign(new Error("Forbidden"), { digest: FORBIDDEN_DIGEST });
  }
  throw err;
}
