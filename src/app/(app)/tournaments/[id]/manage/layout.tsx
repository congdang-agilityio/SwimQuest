import type { ReactNode } from "react";
import { WideContainer } from "@/components/layout/wide-container";

/** Organizer console pages use the wide desktop layout from 1024 px. */
export default function ManageLayout({ children }: { children: ReactNode }) {
  return <WideContainer>{children}</WideContainer>;
}
