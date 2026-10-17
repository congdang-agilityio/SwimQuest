"use client";

import { AccessDenied } from "@/components/states/access-denied";
import { ErrorState } from "@/components/states/error-state";
import { FORBIDDEN_DIGEST } from "@/lib/http/forbidden-digest";

/** Last resort for a thrown error: never shows the error details, only a plain message. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  if (error.digest === FORBIDDEN_DIGEST) return <AccessDenied />;
  return <ErrorState onRetry={reset} />;
}
