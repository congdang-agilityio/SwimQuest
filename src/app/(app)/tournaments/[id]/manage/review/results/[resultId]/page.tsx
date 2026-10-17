import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ReviewItem } from "@/components/review/review-item";
import { RevokeDialog } from "@/components/review/revoke-dialog";
import styles from "@/components/review/review.module.css";
import { AccessDenied } from "@/components/states/access-denied";
import manage from "@/components/tournaments/manage.module.css";
import { ScreenHeader } from "@/components/ui";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";
import { ForbiddenError, NotFoundError } from "@/server/auth/roles";
import { getReviewItem } from "@/server/review/queue";

export const dynamic = "force-dynamic";

/** One swim result for a reviewer (S-46): its facts and shape, and Revoke for a verified one. */
export default async function ReviewResultPage({
  params,
}: {
  params: Promise<{ id: string; resultId: string }>;
}) {
  const { id, resultId } = await params;
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/tournaments");
  const item = await getReviewItem(user.id, resultId).catch((err: unknown) => {
    if (err instanceof NotFoundError) notFound();
    if (err instanceof ForbiddenError) return null;
    throw err;
  });
  if (!item) return <AccessDenied />;
  if (item.tournamentId !== id) notFound();
  const t = await getTranslations("review");
  const tCommon = await getTranslations("common");
  return (
    <main className={manage.screen}>
      <div className={manage.headerBand}>
        <ScreenHeader
          title={t("resultTitle")}
          backHref={`/tournaments/${id}/manage/review`}
          backLabel={tCommon("back")}
        />
      </div>
      <ReviewItem
        item={item}
        action={
          item.status === "VERIFIED" ? (
            <RevokeDialog resultId={item.resultId} playerName={item.player.displayName} />
          ) : (
            <p className={styles.warning}>
              {t("notRevokable", { status: t(`status.${item.status}`) })}
            </p>
          )
        }
      />
    </main>
  );
}
