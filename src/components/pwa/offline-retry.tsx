"use client";

import { Button } from "@/components/ui";

/** Reloads the page the user tried to open (the offline page answers in its place). */
export function OfflineRetry({ label }: { label: string }) {
  return (
    <Button block onClick={() => window.location.reload()}>
      {label}
    </Button>
  );
}
