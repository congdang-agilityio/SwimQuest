import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CreateTournamentForm } from "@/components/tournaments/create-tournament-form";
import styles from "@/components/tournaments/create-tournament.module.css";
import { Card, ScreenHeader } from "@/components/ui";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { effectiveStatus, isSeasonConfigLocked } from "@/lib/tournaments/lifecycle";
import { utcToVnParts } from "@/lib/time/vn";
import { requireUser } from "@/server/auth/current-user";
import { ForbiddenError, NotFoundError, requireOrganizerOrAdmin } from "@/server/auth/roles";

/** Edit tournament (S-34): organizer or admin only; anyone else gets the not-found page. */
export default async function EditTournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(
    (await headers()).get(NEXT_PATH_HEADER) ?? `/tournaments/${id}/manage/edit`,
  );
  const tournament = await requireOrganizerOrAdmin(user, id).catch((err: unknown) => {
    if (err instanceof ForbiddenError || err instanceof NotFoundError) notFound();
    throw err;
  });
  const t = await getTranslations("tournaments");
  const tCommon = await getTranslations("common");
  const now = new Date();
  const status = effectiveStatus(tournament, now);
  return (
    <main className={styles.screen}>
      <div className={styles.headerBand}>
        <ScreenHeader
          title={t("edit.title")}
          backHref={`/tournaments/${tournament.id}/manage`}
          backLabel={tCommon("back")}
        />
      </div>
      {status === "ARCHIVED" ? (
        <Card className={styles.card}>
          <p role="status">{t("edit.archived")}</p>
        </Card>
      ) : (
        <CreateTournamentForm
          edit={{
            id: tournament.id,
            name: tournament.name,
            description: tournament.description,
            seasonStart: utcToVnParts(tournament.seasonStartAt),
            seasonEnd: utcToVnParts(tournament.seasonEndAt),
            startLocked: isSeasonConfigLocked(tournament, now),
            endLocked: status === "COMPLETED",
          }}
        />
      )}
    </main>
  );
}
