import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PublicProfileView } from "@/components/profile/public-profile-view";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";
import { getPublicProfile } from "@/server/profile/public-profile";

/** Another player's profile, filtered by their privacy settings. `?preview=1` on my own id shows what others see. */
export default async function PlayerProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ preview?: string | string[] }>;
}) {
  const { userId } = await params;
  const { preview } = await searchParams;
  const viewer = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? `/players/${userId}`);
  const asOutsider = viewer.id === userId && preview === "1";
  const profile = await getPublicProfile(viewer.id, userId, { asOutsider });
  if (!profile) notFound();
  return <PublicProfileView profile={profile} preview={asOutsider} />;
}
