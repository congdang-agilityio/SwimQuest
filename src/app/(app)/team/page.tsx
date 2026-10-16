import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { JoinGuidance } from "@/components/empty-state/join-guidance";
import { TeamStartCard } from "@/components/starts/team-start-card";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { getRoute } from "@/lib/routes";
import { isStartLocked, startLockAt } from "@/lib/tournaments/lifecycle";
import { requireUser } from "@/server/auth/current-user";
import { getCurrentMembership } from "@/server/home/my-tournaments";
import { ensureStartsAssigned } from "@/server/jobs/tick";
import { getMyTeamView } from "@/server/teams/my-team-view";
import { TeamHeader } from "@/components/teams/team-header";
import { TeamRoster } from "@/components/teams/team-roster";

export default async function TeamPage() {
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/team");
  const t = await getTranslations("tabs.team");
  let membership = await getCurrentMembership(user.id);
  // Catch up the automatic assignment right after the deadline, before the scheduler runs.
  if (membership && (await ensureStartsAssigned(membership.tournament.id, new Date())) > 0) {
    membership = await getCurrentMembership(user.id);
  }
  const view = membership ? await getMyTeamView(user.id) : null;
  return (
    <main>
      <h1>{t("title")}</h1>
      {membership && view ? (
        <>
          <TeamHeader
            team={view.team}
            captainName={view.captain?.displayName ?? null}
            progressBp={view.progress.progressBp}
            teamPoints={view.teamPoints}
            memberCount={view.memberCount}
          >
            <TeamStartCard
              startNameKey={
                getRoute(membership.tournament.routeId)?.destinations.find(
                  (d) => d.slug === membership.team.startDestination,
                )?.nameKey ?? null
              }
              isCaptain={membership.team.captainUserId === user.id}
              lockAtIso={startLockAt(membership.tournament).toISOString()}
              locked={isStartLocked(membership.tournament, new Date())}
              autoAssignedAtIso={
                membership.team.startSetBy === "AUTOMATIC"
                  ? (membership.team.startSetAt?.toISOString() ?? null)
                  : null
              }
            />
          </TeamHeader>
          <TeamRoster members={view.roster} />
        </>
      ) : (
        <JoinGuidance />
      )}
    </main>
  );
}
