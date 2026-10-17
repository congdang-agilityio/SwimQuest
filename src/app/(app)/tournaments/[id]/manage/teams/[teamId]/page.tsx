import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { OrganizerStartPanel } from "@/components/starts/organizer-start-panel";
import { RosterList } from "@/components/teams/roster-list";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { getRoute, startDestinations } from "@/lib/routes";
import { effectiveStatus, isStartLocked, startLockAt } from "@/lib/tournaments/lifecycle";
import { requireUser } from "@/server/auth/current-user";
import { ForbiddenError, NotFoundError, requireOrganizer } from "@/server/auth/roles";
import { db } from "@/server/db";
import { getTeamRoster } from "@/server/teams/roster";

export const dynamic = "force-dynamic";

/** Organizer team page: roster, captain mark and Make captain. Anyone else gets not-found. */
export default async function OrganizerTeamPage({
  params,
}: {
  params: Promise<{ id: string; teamId: string }>;
}) {
  const { id, teamId } = await params;
  const path = (await headers()).get(NEXT_PATH_HEADER) ?? "/tournaments";
  const user = await requireUser(path);
  await requireOrganizer(user.id, id).catch((err: unknown) => {
    if (err instanceof ForbiddenError || err instanceof NotFoundError) notFound();
    throw err;
  });
  const team = await db.team.findFirst({
    where: { id: teamId, tournamentId: id },
    select: {
      id: true,
      name: true,
      startDestination: true,
      startSetBy: true,
      startSetAt: true,
      tournament: {
        select: {
          routeId: true,
          status: true,
          seasonStartAt: true,
          seasonEndAt: true,
          startChoiceDeadlineAt: true,
        },
      },
    },
  });
  if (!team) notFound();
  const route = getRoute(team.tournament.routeId);
  const members = await getTeamRoster(team.id);
  const others = await db.team.findMany({
    where: { tournamentId: id, id: { not: team.id } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      memberLimit: true,
      _count: { select: { members: { where: { status: "ACTIVE" } } } },
    },
  });
  const t = await getTranslations("captain");
  return (
    <main>
      <p>
        <Link href={`/tournaments/${id}/manage`}>{t("back")}</Link>
      </p>
      <h1>{team.name}</h1>
      {route && (
        <OrganizerStartPanel
          teamId={team.id}
          starts={startDestinations(route).map((d) => ({ slug: d.slug, nameKey: d.nameKey }))}
          currentSlug={team.startDestination}
          setBy={team.startSetBy}
          setAtIso={team.startSetAt?.toISOString() ?? null}
          lockAtIso={startLockAt(team.tournament).toISOString()}
          locked={isStartLocked(team.tournament, new Date())}
        />
      )}
      <RosterList
        teamId={team.id}
        afterStart={!["DRAFT", "PUBLISHED"].includes(effectiveStatus(team.tournament, new Date()))}
        moveTargets={others.map((o) => ({
          id: o.id,
          name: o.name,
          free: Math.max(0, o.memberLimit - o._count.members),
        }))}
        members={members.map((m) => ({
          id: m.id,
          displayName: m.displayName,
          isCaptain: m.isCaptain,
        }))}
      />
    </main>
  );
}
