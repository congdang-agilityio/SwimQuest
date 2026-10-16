import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { JoinGuidance } from "@/components/empty-state/join-guidance";
import { RouteMap } from "@/components/voyage/route-map";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";
import { getVoyage } from "@/server/voyage/get-voyage";

// Always computed from current points: refreshing after a verified swim shows the new position.
export const dynamic = "force-dynamic";

export default async function VoyagePage() {
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/voyage");
  const [t, voyage] = await Promise.all([getTranslations("tabs.voyage"), getVoyage(user.id)]);
  return (
    <main>
      <h1>{t("title")}</h1>
      {voyage ? (
        <>
          <p>{t("tournament", { name: voyage.tournament.name })}</p>
          <RouteMap
            routeId={voyage.tournament.routeId}
            teamName={voyage.team.name}
            destinations={voyage.destinations}
            path={voyage.path}
            start={
              voyage.start
                ? {
                    slug: voyage.start.slug,
                    automaticAtIso:
                      voyage.start.setBy === "AUTOMATIC" && voyage.start.setAt
                        ? voyage.start.setAt.toISOString()
                        : null,
                  }
                : null
            }
            progress={voyage.progress}
            ship={voyage.ship}
          />
        </>
      ) : (
        <JoinGuidance />
      )}
    </main>
  );
}
