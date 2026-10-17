import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArchiveButton } from "@/components/organizer/archive-button";
import { ConsoleHeader } from "@/components/organizer/console-header";
import { ConsoleLinks } from "@/components/organizer/console-links";
import { ProgressSection } from "@/components/organizer/progress-section";
import { StartsSection } from "@/components/organizer/starts-section";
import { TeamsSection } from "@/components/organizer/teams-section";
import { UnassignedPlayers } from "@/components/organizer/unassigned-players";
import { TeamList } from "@/components/teams/team-list";
import { InviteLink } from "@/components/tournaments/invite-link";
import styles from "@/components/tournaments/manage.module.css";
import { PublishPanel } from "@/components/tournaments/publish-panel";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { getRoute } from "@/lib/routes";
import { isStartLocked, startLockAt } from "@/lib/tournaments/lifecycle";
import { requireUser } from "@/server/auth/current-user";
import { ForbiddenError, NotFoundError, requireOrganizerOrAdmin } from "@/server/auth/roles";
import { pageOrigin } from "@/server/http/request";
import { getConsoleOverview } from "@/server/organizer/console";
import { getConsoleTeams } from "@/server/organizer/participation";
import { listTeamsWithCounts } from "@/server/teams/manage";

/**
 * Organizer page: only the organizer (or a platform admin, S-72) sees it; anyone else gets the
 * not-found page (S-04 AC 5).
 */
export default async function ManageTournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/tournaments");
  const tournament = await requireOrganizerOrAdmin(user, id).catch((err: unknown) => {
    if (err instanceof ForbiddenError || err instanceof NotFoundError) notFound();
    throw err;
  });
  const now = new Date();
  // The console reads are organizer-scoped; an admin reads them as the tournament's organizer.
  const organizerId = tournament.organizerId;
  // Assigns starts due at the lock first, so the team list below shows them.
  const overview = await getConsoleOverview(organizerId, tournament.id, now);
  const [{ teams, capacity }, consoleTeams] = await Promise.all([
    listTeamsWithCounts(tournament.id),
    getConsoleTeams(organizerId, tournament.id, now),
  ]);
  const unassigned = tournament.status === "DRAFT" ? [] : consoleTeams.unassignedPlayers;
  const destinations = getRoute(tournament.routeId)?.destinations ?? [];
  const nameKeys = Object.fromEntries(destinations.map((d) => [d.slug, d.nameKey]));
  const rows = teams.map((team) => ({
    ...team,
    startNameKey: destinations.find((d) => d.slug === team.startDestination)?.nameKey ?? null,
    autoAssignedAtIso:
      team.startSetBy === "AUTOMATIC" ? (team.startSetAt?.toISOString() ?? null) : null,
  }));
  const startLock =
    tournament.status === "DRAFT"
      ? undefined
      : {
          locked: isStartLocked(tournament, now),
          lockAtIso: startLockAt(tournament).toISOString(),
        };
  const tCommon = await getTranslations("common");
  const showInvite = tournament.status !== "DRAFT" && Boolean(tournament.inviteToken);
  const origin = showInvite ? pageOrigin(await headers()) : null;
  return (
    <main className={styles.screen} data-wide-grid>
      <ConsoleHeader
        name={tournament.name}
        status={overview.status}
        timeline={overview.timeline}
        now={now}
        backLabel={tCommon("back")}
        controls={
          overview.actions.canPublish ? (
            <PublishPanel tournamentId={tournament.id} />
          ) : overview.actions.canArchive ? (
            <ArchiveButton tournamentId={tournament.id} />
          ) : undefined
        }
      />
      <ConsoleLinks
        tournamentId={tournament.id}
        published={tournament.status !== "DRAFT"}
        hasInvite={Boolean(showInvite && origin)}
        canEdit={overview.status !== "ARCHIVED"}
      />
      {(overview.status === "ACTIVE" || overview.status === "COMPLETED") && (
        <ProgressSection tournamentId={tournament.id} teams={consoleTeams.teams} />
      )}
      <TeamsSection
        tournamentId={tournament.id}
        teams={consoleTeams.teams}
        unassignedCount={unassigned.length}
      />
      <StartsSection
        tournamentId={tournament.id}
        starts={overview.starts}
        locked={overview.startsLocked}
        lockAt={tournament.status === "DRAFT" ? null : overview.timeline.startChoiceLocksAt}
        nameKeys={nameKeys}
      />
      {showInvite && origin && (
        <InviteLink
          tournamentId={tournament.id}
          enabled={tournament.inviteEnabled}
          url={`${origin}/join/${tournament.inviteToken}`}
          tournamentName={tournament.name}
        />
      )}
      {tournament.status !== "DRAFT" && (
        <UnassignedPlayers
          players={unassigned.map((p) => ({
            id: p.id,
            displayName: p.displayName,
            removedAfterStart: p.removedAfterStart,
          }))}
          teams={teams.map((team) => ({
            id: team.id,
            name: team.name,
            free: Math.max(0, team.memberLimit - team.memberCount),
          }))}
        />
      )}
      <TeamList
        tournamentId={tournament.id}
        teams={rows}
        capacity={capacity}
        isDraft={tournament.status === "DRAFT"}
        startLock={startLock}
      />
    </main>
  );
}
