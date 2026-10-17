import { recordFunnelEventSafe } from "@/server/funnel/safe";
import { SignUpForm } from "./signup-form";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  await recordFunnelEventSafe("account_signup_started"); // no user yet
  return <SignUpForm next={typeof next === "string" ? next : undefined} />;
}
