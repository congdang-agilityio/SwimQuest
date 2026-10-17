import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ReviewHelpers } from "@/components/organizer/review-helpers";
import manage from "@/components/tournaments/manage.module.css";
import { ScreenHeader } from "@/components/ui";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";
import { ForbiddenError, NotFoundError, requireOrganizer } from "@/server/auth/roles";
import { db } from "@/server/db";
import { listHelpers } from "@/server/review/helpers";

export const dynamic = "force-dynamic";

/** Review helpers (S-45): the organizer appoints and removes helpers; anyone else gets not-found. */
export default async function ReviewHelpersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/tournaments");
  const tournament = await requireOrganizer(user.id, id).catch((err: unknown) => {
    if (err instanceof ForbiddenError || err instanceof NotFoundError) notFound();
    throw err;
  });
  const helpers = await listHelpers(user.id, tournament.id);
  const helperIds = new Set(helpers.map((h) => h.userId));
  const members = await db.teamMember.findMany({
    where: { tournamentId: tournament.id, status: "ACTIVE" },
    orderBy: { user: { displayName: "asc" } },
    select: { userId: true, user: { select: { displayName: true } } },
  });
  const players = members
    .filter((m) => !helperIds.has(m.userId))
    .map((m) => ({ userId: m.userId, displayName: m.user.displayName }));
  const t = await getTranslations("helpers");
  const tCommon = await getTranslations("common");
  return (
    <main className={manage.screen}>
      <div className={manage.headerBand}>
        <ScreenHeader
          title={t("title")}
          backHref={`/tournaments/${tournament.id}/manage`}
          backLabel={tCommon("back")}
        />
      </div>
      <ReviewHelpers
        tournamentId={tournament.id}
        tournamentName={tournament.name}
        helpers={helpers.map((h) => ({ userId: h.userId, displayName: h.displayName }))}
        players={players}
      />
    </main>
  );
}
