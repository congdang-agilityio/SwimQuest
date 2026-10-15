import { headers } from "next/headers";
import type { ReactNode } from "react";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";

/** Session checks must run on every request; protected pages are never statically cached. */
export const dynamic = "force-dynamic";

/**
 * Every signed-in page lives under this layout. Middleware only checks that a cookie exists;
 * here the session is validated in the database, so an expired or deleted session lands on login.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const nextPath = (await headers()).get(NEXT_PATH_HEADER) ?? "/";
  await requireUser(nextPath);
  return children;
}
