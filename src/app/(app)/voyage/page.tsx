import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { JoinGuidance } from "@/components/empty-state/join-guidance";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";
import { getCurrentMembership } from "@/server/home/my-tournaments";

export default async function VoyagePage() {
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/voyage");
  const [t, membership] = await Promise.all([
    getTranslations("tabs.voyage"),
    getCurrentMembership(user.id),
  ]);
  return (
    <main>
      <h1>{t("title")}</h1>
      {membership ? (
        <p>{t("tournament", { name: membership.tournament.name })}</p>
      ) : (
        <JoinGuidance />
      )}
    </main>
  );
}
