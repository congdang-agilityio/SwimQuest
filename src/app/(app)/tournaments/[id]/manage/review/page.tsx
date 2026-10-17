import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ReviewItem } from "@/components/review/review-item";
import styles from "@/components/review/review.module.css";
import { AccessDenied } from "@/components/states/access-denied";
import { StateCard } from "@/components/states/state-card";
import manage from "@/components/tournaments/manage.module.css";
import { Card, Chip, ScreenHeader } from "@/components/ui";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";
import { ForbiddenError, NotFoundError, requireReviewer } from "@/server/auth/roles";
import { getDisputeQueue, getReviewItem, getReviewQueue } from "@/server/review/queue";

export const dynamic = "force-dynamic";

/** Review queue (S-43): the tournament's flagged swims, for its reviewers only. */
export default async function ReviewQueuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/tournaments");
  const tournament = await requireReviewer(user.id, id).catch((err: unknown) => {
    if (err instanceof NotFoundError) notFound();
    if (err instanceof ForbiddenError) return null;
    throw err;
  });
  if (!tournament) return <AccessDenied />;
  const queue = await getReviewQueue(user.id, tournament.id);
  // Each item with its simplified track: the shape is for this tournament's reviewers only.
  const items = await Promise.all(queue.map((q) => getReviewItem(user.id, q.resultId)));
  const disputeQueue = await getDisputeQueue(user.id, tournament.id);
  const disputes = await Promise.all(
    disputeQueue.map(async (q) => ({
      ...(await getReviewItem(user.id, q.resultId)),
      dispute: q.dispute,
    })),
  );
  const t = await getTranslations("review");
  const tCommon = await getTranslations("common");
  return (
    <main className={manage.screen}>
      <div className={manage.headerBand}>
        <ScreenHeader
          title={t("title")}
          // A helper is not the organizer: the organizer page is not theirs, so they go back Home.
          backHref={
            tournament.organizerId === user.id ? `/tournaments/${tournament.id}/manage` : "/"
          }
          backLabel={tCommon("back")}
        />
      </div>
      <Card className={styles.intro}>
        <p>
          <strong>{tournament.name}</strong>
        </p>
        <p>{t("intro")}</p>
        <Chip
          tone={items.length + disputes.length ? "warning" : "success"}
          className={styles.count}
        >
          {t("count", { count: items.length + disputes.length })}
        </Chip>
      </Card>
      {items.length + disputes.length === 0 ? (
        <StateCard
          art="effects/wave"
          titleId="review-empty"
          title={t("empty.title")}
          body={t("empty.body")}
        />
      ) : items.length > 0 ? (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.resultId}>
              <ReviewItem item={item} />
            </li>
          ))}
        </ul>
      ) : null}
      {disputes.length > 0 && (
        <section aria-labelledby="review-disputes" className={styles.disputes}>
          <h2 id="review-disputes" className={styles.sectionTitle}>
            {t("disputes.title", { count: disputes.length })}
          </h2>
          <ul className={styles.list}>
            {disputes.map((item) => (
              <li key={item.dispute.id}>
                <ReviewItem item={item} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
