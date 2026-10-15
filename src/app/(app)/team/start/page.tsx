import { headers } from "next/headers";
import { JoinGuidance } from "@/components/empty-state/join-guidance";
import { StartPicker } from "@/components/starts/start-picker";
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
  return (
    <main>
      <StartPicker
        teamId={team.id}
        starts={startDestinations(route).map((d) => d.slug)}
        finish={finish?.slug ?? "ly_son"}
        currentSlug={team.startDestination}
        routeDistanceKm={tournament.routeDistanceM / 1000}
        lockAtIso={startLockAt(tournament).toISOString()}
        readOnly={team.captainUserId !== user.id || locked}
      />
    </main>
  );
}
