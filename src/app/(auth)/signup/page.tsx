import { SignUpForm } from "./signup-form";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  return <SignUpForm next={typeof next === "string" ? next : undefined} />;
}
