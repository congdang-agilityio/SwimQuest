import type { ChipTone } from "@/components/ui";

/** Status chip tone: active is calm, a suspension is red, anything else needs attention. */
export const statusTone = (status: string): ChipTone =>
  status === "ACTIVE" ? "success" : status === "SUSPENDED" ? "danger" : "warning";
