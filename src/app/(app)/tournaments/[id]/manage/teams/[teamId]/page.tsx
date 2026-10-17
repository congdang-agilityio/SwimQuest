import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { StartCorrectionDialog } from "@/components/admin/start-correction-dialog";
import { OrganizerStartPanel } from "@/components/starts/organizer-start-panel";
import { RosterList } from "@/components/teams/roster-list";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { getRoute, startDestinations } from "@/lib/routes";
import { effectiveStatus, isStartLocked, startLockAt } from "@/lib/tournaments/lifecycle";
import { requireUser } from "@/server/auth/current-user";
import { ForbiddenError, NotFoundError, requireOrganizerOrAdmin } from "@/server/auth/roles";
import { db } from "@/server/db";
import { getTeamRoster } from "@/server/teams/roster";

export const dynamic = "force-dynamic";

/**
 * Organizer team page: roster, captain mark and Make captain. Platform admins may open it too and,
 * after the start lock, get the exceptional start correction (S-72). Anyone else gets not-found.
 */
export default async function OrganizerTeamPage({
  params,
}: {
  params: Promise<{ id: string; teamId: string }>;
}) {
  const { id, teamId } = await params;
  const path = (await headers()).get(NEXT_PATH_HEADER) ?? "/tournaments";
  const user = await requireUser(path);
  await requireOrganizerOrAdmin(user, id).catch((err: unknown) => {
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
  const starts = route
    ? startDestinations(route).map((d) => ({ slug: d.slug, nameKey: d.nameKey }))
    : [];
  const locked = isStartLocked(team.tournament, new Date());
  return (
    <main>
      <p>
        <Link href={`/tournaments/${id}/manage`}>{t("back")}</Link>
      </p>
      <h1>{team.name}</h1>
      {route && (
        <OrganizerStartPanel
          teamId={team.id}
          starts={starts}
          currentSlug={team.startDestination}
          setBy={team.startSetBy}
          setAtIso={team.startSetAt?.toISOString() ?? null}
          lockAtIso={startLockAt(team.tournament).toISOString()}
          locked={locked}
        />
      )}
      {route && user.isPlatformAdmin && locked && team.tournament.status !== "ARCHIVED" && (
        <StartCorrectionDialog
          teamId={team.id}
          starts={starts}
          currentSlug={team.startDestination}
        />
      )}
      <RosterList
        teamId={team.id}
        memberHref={(userId) => `/tournaments/${id}/manage/teams/${team.id}/members/${userId}`}
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
