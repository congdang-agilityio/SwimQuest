import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { RosterList } from "@/components/teams/roster-list";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
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
    select: { id: true, name: true },
  });
  if (!team) notFound();
  const members = await getTeamRoster(team.id);
  const t = await getTranslations("captain");
  return (
    <main>
      <p>
        <Link href={`/tournaments/${id}/manage`}>{t("back")}</Link>
      </p>
      <h1>{team.name}</h1>
      <RosterList
        teamId={team.id}
        members={members.map((m) => ({
          id: m.id,
          displayName: m.displayName,
          isCaptain: m.isCaptain,
        }))}
      />
    </main>
  );
}
