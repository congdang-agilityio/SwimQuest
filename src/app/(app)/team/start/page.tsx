import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { JoinGuidance } from "@/components/empty-state/join-guidance";
import { StartPicker } from "@/components/starts/start-picker";
import styles from "@/components/starts/start-picker.module.css";
import { ScreenHeader } from "@/components/ui";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { getRoute, startDestinations } from "@/lib/routes";
import { isStartLocked, startLockAt } from "@/lib/tournaments/lifecycle";
import { requireUser } from "@/server/auth/current-user";
import { getCurrentMembership } from "@/server/home/my-tournaments";

export default async function TeamStartPage() {
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/team/start");
  const membership = await getCurrentMembership(user.id);
  const route = membership ? getRoute(membership.tournament.routeId) : null;
  if (!membership || !route) return <JoinGuidance />;
  const { team, tournament } = membership;
  const finish = route.destinations.find((d) => d.isFinish);
  const locked = isStartLocked(tournament, new Date());
  const pick = (d: { slug: string; nameKey: string }) => ({ slug: d.slug, nameKey: d.nameKey });
  const t = await getTranslations();
  return (
    <main className={styles.screen}>
      <div className={styles.headerBand}>
        <ScreenHeader
          id="start-picker-title"
          title={t("starts.picker.title")}
          backHref="/team"
          backLabel={t("common.back")}
        />
      </div>
      <StartPicker
        teamId={team.id}
        starts={startDestinations(route).map(pick)}
        finish={finish ? pick(finish) : null}
        currentSlug={team.startDestination}
        routeDistanceKm={tournament.routeDistanceM / 1000}
        lockAtIso={startLockAt(tournament).toISOString()}
        locked={locked}
        readOnly={team.captainUserId !== user.id || locked}
      />
    </main>
  );
}
