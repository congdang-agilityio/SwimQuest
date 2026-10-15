import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { TournamentSummary } from "@/components/tournaments/tournament-summary";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";
import { ForbiddenError, NotFoundError, requireOrganizer } from "@/server/auth/roles";
import { listTeamsWithCounts } from "@/server/teams/manage";

/** Preview of the tournament as players will see it; organizer only, others get not-found. */
export default async function PreviewTournamentPage({
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
  const { teams } = await listTeamsWithCounts(tournament.id);
  const t = await getTranslations("publish.preview");
  return (
    <main>
      <h1>{t("title")}</h1>
      <TournamentSummary
        name={tournament.name}
        description={tournament.description}
        seasonStartAt={tournament.seasonStartAt}
        seasonEndAt={tournament.seasonEndAt}
        routeId={tournament.routeId}
        routeDistanceM={tournament.routeDistanceM}
        teams={teams.map((x) => ({
          id: x.id,
          name: x.name,
          emblemKey: x.emblemKey,
          freePlaces: Math.max(0, x.memberLimit - x.memberCount),
        }))}
      />
      <Link
        href={`/tournaments/${tournament.id}/manage`}
        style={{ display: "inline-block", minHeight: 44, minWidth: 44, padding: 8 }}
      >
        {t("back")}
      </Link>
    </main>
  );
}
