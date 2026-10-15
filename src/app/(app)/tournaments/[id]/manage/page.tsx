import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { TeamList } from "@/components/teams/team-list";
import { InviteLink } from "@/components/tournaments/invite-link";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { utcToVnParts } from "@/lib/time/vn";
import { requireUser } from "@/server/auth/current-user";
import { ForbiddenError, NotFoundError, requireOrganizer } from "@/server/auth/roles";
import { listTeamsWithCounts } from "@/server/teams/manage";

/** Public origin for the invite link: the trusted APP_URL, else the request host. */
async function origin(): Promise<string> {
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {}
  }
  const h = await headers();
  const host = h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() === "https" ? "https" : "http";
  return `${proto}://${host}`;
}

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
  const t = await getTranslations("organizer");
  const when = (d: Date) => {
    const { date, time } = utcToVnParts(d);
    return `${time} ${date}`;
  };
  return (
    <main>
      <h1>{tournament.name}</h1>
      <p>
        {t("manage.status")}: <strong>{t(`manage.statusNames.${tournament.status}`)}</strong>
      </p>
      <p>
        {t("manage.season")}: {when(tournament.seasonStartAt)} - {when(tournament.seasonEndAt)} (
        {t("manage.vietnamTime")})
      </p>
      {tournament.status !== "DRAFT" && tournament.inviteToken && (
        <InviteLink
          url={`${await origin()}/join/${tournament.inviteToken}`}
          tournamentName={tournament.name}
        />
      )}
      <TeamList
        tournamentId={tournament.id}
        teams={teams}
        capacity={capacity}
        isDraft={tournament.status === "DRAFT"}
      />
    </main>
  );
}
