import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { StateCard } from "@/components/states/state-card";
import { JoinGuidance } from "@/components/empty-state/join-guidance";
import { MyPointsCard } from "@/components/scoring/my-points-card";
import { FinishLostNotice } from "@/components/finish/finish-lost-notice";
import { TeamFinish } from "@/components/finish/team-finish";
import { TeamStartCard } from "@/components/starts/team-start-card";
import styles from "@/components/teams/my-team.module.css";
import { ButtonLink } from "@/components/ui";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { getRoute } from "@/lib/routes";
import { effectiveStatus, isStartLocked, startLockAt } from "@/lib/tournaments/lifecycle";
import { requireUser } from "@/server/auth/current-user";
import { getCurrentMembership } from "@/server/home/my-tournaments";
import { ensureStartsAssigned } from "@/server/jobs/tick";
import { getMyPoints } from "@/server/scoring/my-points";
import { listTeamsWithCounts } from "@/server/teams/manage";
import { getLastRemoval, getMyTeamView } from "@/server/teams/my-team-view";
import { TeamHeader } from "@/components/teams/team-header";
import { LeaveSwitchActions } from "@/components/teams/leave-switch-actions";
import { TeamRoster } from "@/components/teams/team-roster";

export default async function TeamPage() {
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/team");
  const t = await getTranslations("tabs.team");
  const tTeam = await getTranslations("team");
  let membership = await getCurrentMembership(user.id);
  // Catch up the automatic assignment right after the deadline, before the scheduler runs.
  if (membership && (await ensureStartsAssigned(membership.tournament.id, new Date())) > 0) {
    membership = await getCurrentMembership(user.id);
  }
  const view = membership ? await getMyTeamView(user.id) : null;
  const removal = membership ? null : await getLastRemoval(user.id);
  const myPoints = membership ? await getMyPoints(user.id, membership.tournament.id) : null;
  const status = membership ? effectiveStatus(membership.tournament, new Date()) : null;
  const beforeStart = status === "DRAFT" || status === "PUBLISHED";
  const otherTeams =
    membership && beforeStart
      ? (await listTeamsWithCounts(membership.tournament.id)).teams
          .filter((x) => x.id !== membership.team.id)
          .map((x) => ({
            id: x.id,
            name: x.name,
            emblemKey: x.emblemKey,
            freePlaces: Math.max(0, x.memberLimit - x.memberCount),
          }))
      : [];
  const startSlug = membership?.team.startDestination ?? null;
  return (
    <main>
      <div className={styles.layout}>
        <div className={styles.panel}>
          <h1 className={styles.title}>{t("title")}</h1>
          {membership && view ? (
            <>
              <TeamHeader
                team={view.team}
                captainName={view.captain?.displayName ?? null}
                progressBp={view.progress.progressBp}
                teamPoints={view.teamPoints}
                memberCount={view.memberCount}
                finishedAt={view.finishedAt}
              />
              <TeamRoster
                members={view.roster}
                handoverTeamId={
                  membership.team.captainUserId === user.id ? membership.team.id : undefined
                }
                afterStart={!beforeStart}
              />
              <div className={styles.footer}>
                <ButtonLink href="/connect" variant="primary" block>
                  {tTeam("addSwim")}
                </ButtonLink>
              </div>
              <LeaveSwitchActions
                teamId={membership.team.id}
                teamName={view.team.name}
                isCaptain={membership.team.captainUserId === user.id}
                beforeStart={beforeStart}
                otherTeams={otherTeams}
              />
            </>
          ) : (
            <div className={styles.empty}>
              {removal && (
                <StateCard
                  art="items/message-bottle"
                  role="status"
                  titleId="removed-title"
                  title={tTeam("removed.title", { team: removal.teamName })}
                  body={tTeam(removal.afterStart ? "removed.afterStart" : "removed.beforeStart", {
                    team: removal.teamName,
                    tournament: removal.tournamentName,
                  })}
                />
              )}
              <JoinGuidance />
            </div>
          )}
        </div>
        <FinishLostNotice userId={user.id} />
        {view?.finishedAt && <TeamFinish userId={user.id} />}
        {myPoints && <MyPointsCard points={myPoints} />}
        {membership && view && (
          <TeamStartCard
            startSlug={startSlug}
            startNameKey={
              getRoute(membership.tournament.routeId)?.destinations.find(
                (d) => d.slug === startSlug,
              )?.nameKey ?? null
            }
            isCaptain={membership.team.captainUserId === user.id}
            lockAtIso={startLockAt(membership.tournament).toISOString()}
            locked={isStartLocked(membership.tournament, new Date())}
            startSetBy={membership.team.startSetBy}
            autoAssignedAtIso={
              membership.team.startSetBy === "AUTOMATIC"
                ? (membership.team.startSetAt?.toISOString() ?? null)
                : null
            }
          />
        )}
      </div>
    </main>
  );
}
