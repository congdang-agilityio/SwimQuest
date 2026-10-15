import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { TeamList } from "@/components/teams/team-list";
import { InviteLink } from "@/components/tournaments/invite-link";
import { PublishPanel } from "@/components/tournaments/publish-panel";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { getRoute } from "@/lib/routes";
import { effectiveStatus, isStartLocked, startLockAt } from "@/lib/tournaments/lifecycle";
import { utcToVnParts } from "@/lib/time/vn";
import { requireUser } from "@/server/auth/current-user";
import { ForbiddenError, NotFoundError, requireOrganizer } from "@/server/auth/roles";
import { pageOrigin } from "@/server/http/request";
import { listTeamsWithCounts } from "@/server/teams/manage";

/** Organizer page: only the organizer sees it; anyone else gets the not-found page (S-04 AC 5). */
export default async function ManageTournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/tournaments");
  const tournament = await requireOrganizer(user.id, id).catch((err: unknown) => {
    if (err instanceof ForbiddenError || err instanceof NotFoundError) notFound();
    throw err;
  });
  const { teams, capacity } = await listTeamsWithCounts(tournament.id);
  const now = new Date();
  const status = effectiveStatus(tournament, now);
  const destinations = getRoute(tournament.routeId)?.destinations ?? [];
  const rows = teams.map((team) => ({
    ...team,
    startNameKey: destinations.find((d) => d.slug === team.startDestination)?.nameKey ?? null,
  }));
  const startLock =
    tournament.status === "DRAFT"
      ? undefined
      : {
          locked: isStartLocked(tournament, now),
          lockAtIso: startLockAt(tournament).toISOString(),
        };
  const t = await getTranslations("organizer");
  const showInvite = tournament.status !== "DRAFT" && Boolean(tournament.inviteToken);
  const origin = showInvite ? pageOrigin(await headers()) : null;
  const when = (d: Date) => {
    const { date, time } = utcToVnParts(d);
    return `${time} ${date}`;
  };
  return (
    <main>
      <h1>{tournament.name}</h1>
      <p>
        {t("manage.status")}: <strong>{t(`manage.statusNames.${status}`)}</strong>
      </p>
      <p id="season">
        {t("manage.season")}: {when(tournament.seasonStartAt)} - {when(tournament.seasonEndAt)} (
        {t("manage.vietnamTime")})
      </p>
      {tournament.status === "DRAFT" && <PublishPanel tournamentId={tournament.id} />}
      {showInvite && origin && (
        <InviteLink
          url={`${origin}/join/${tournament.inviteToken}`}
          tournamentName={tournament.name}
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
