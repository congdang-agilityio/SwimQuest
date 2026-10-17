import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { GiveSpecialBadge } from "@/components/badges/give-special-badge";
import { MemberResults } from "@/components/review/member-results";
import styles from "@/components/review/review.module.css";
import { AccessDenied } from "@/components/states/access-denied";
import manage from "@/components/tournaments/manage.module.css";
import { ScreenHeader } from "@/components/ui";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";
import { ForbiddenError, isOrganizer, NotFoundError } from "@/server/auth/roles";
import { db } from "@/server/db";
import { listMemberResults } from "@/server/review/member-results";

export const dynamic = "force-dynamic";

/** Organizer member page (S-48): the member's results in this tournament, for reviewers only. */
export default async function OrganizerMemberPage({
  params,
}: {
  params: Promise<{ id: string; teamId: string; userId: string }>;
}) {
  const { id, teamId, userId } = await params;
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/tournaments");
  const data = await listMemberResults(user.id, id, userId).catch((err: unknown) => {
    if (err instanceof NotFoundError) notFound();
    if (err instanceof ForbiddenError) return null;
    throw err;
  });
  if (!data) return <AccessDenied />;
  const organizer = await isOrganizer(user.id, id);
  const special = organizer
    ? await db.badge.findFirst({
        where: { tournamentId: id, userId, kind: "SPECIAL", removedAt: null },
        select: { reason: true },
      })
    : null;
  const t = await getTranslations("review");
  const tCommon = await getTranslations("common");
  return (
    <main className={manage.screen}>
      <div className={manage.headerBand}>
        <ScreenHeader
          title={data.member.displayName}
          backHref={`/tournaments/${id}/manage/teams/${teamId}`}
          backLabel={tCommon("back")}
        />
      </div>
      {organizer && (
        <GiveSpecialBadge
          tournamentId={id}
          userId={userId}
          givenReason={special ? (special.reason ?? "") : null}
        />
      )}
      <h2 className={styles.sectionTitle}>{t("member.title")}</h2>
      <MemberResults
        results={data.results}
        resultHref={(resultId) => `/tournaments/${id}/manage/review/results/${resultId}`}
      />
    </main>
  );
}
