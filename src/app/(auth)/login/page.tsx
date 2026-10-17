import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { LoginForm } from "./login-form";

/** Session checks must run on every request. */
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; suspended?: string | string[] }>;
}) {
  if (await getCurrentUser()) redirect("/");
  const { next, suspended } = await searchParams;
  return (
    <LoginForm next={typeof next === "string" ? next : undefined} suspended={suspended === "1"} />
  );
}
