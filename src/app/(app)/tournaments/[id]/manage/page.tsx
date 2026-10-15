import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { utcToVnParts } from "@/lib/time/vn";
import { requireUser } from "@/server/auth/current-user";
import { ForbiddenError, NotFoundError, requireOrganizer } from "@/server/auth/roles";

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
  const [t, tabs] = await Promise.all([
    getTranslations("tournaments"),
    getTranslations("tabs.tournaments"),
  ]);
  const when = (d: Date) => {
    const { date, time } = utcToVnParts(d);
    return `${time} ${date}`;
  };
  return (
    <main>
      <h1>{tournament.name}</h1>
      <p>
        {t("manage.status")}: <strong>{tabs(`status.${tournament.status}`)}</strong>
      </p>
      <p>
        {t("manage.season")}: {when(tournament.seasonStartAt)} - {when(tournament.seasonEndAt)} (
        {t("create.vietnamTime")})
      </p>
    </main>
  );
}
