import type { ReactNode } from "react";
import { WideContainer } from "@/components/layout/wide-container";
import { AccessDenied } from "@/components/states/access-denied";
import { getCurrentUser } from "@/server/auth/current-user";
import { ForbiddenError, requirePlatformAdmin } from "@/server/auth/roles";

/** Admin area guard: every /admin page is for platform admins; others see access denied. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  try {
    requirePlatformAdmin(await getCurrentUser());
  } catch (err) {
    if (err instanceof ForbiddenError) return <AccessDenied />;
    throw err;
  }
  return <WideContainer>{children}</WideContainer>;
}
