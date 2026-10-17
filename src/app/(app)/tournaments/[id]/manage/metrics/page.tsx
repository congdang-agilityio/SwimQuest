import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MetricsOverview } from "@/components/organizer/metrics-overview";
import { AccessDenied } from "@/components/states/access-denied";
import { StateCard } from "@/components/states/state-card";
import manage from "@/components/tournaments/manage.module.css";
import { Card, ScreenHeader } from "@/components/ui";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";
import { ForbiddenError, NotFoundError, requireOrganizer } from "@/server/auth/roles";
import { getTournamentMetrics } from "@/server/organizer/metrics";

export const dynamic = "force-dynamic";

/** Organizer Metrics (S-80): participation and verification; `?tab=` is reserved for Fairness. */
export default async function MetricsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/tournaments");
  const tournament = await requireOrganizer(user.id, id).catch((err: unknown) => {
    if (err instanceof NotFoundError) notFound();
    if (err instanceof ForbiddenError) return null;
    throw err;
  });
  if (!tournament) return <AccessDenied />;
  const metrics = await getTournamentMetrics(user.id, tournament.id);
  const t = await getTranslations("metrics");
  const base = `/tournaments/${tournament.id}/manage`;
  return (
    <main className={manage.screen}>
      <div className={manage.headerBand}>
        <ScreenHeader title={t("title")} backHref={base} backLabel={t("back")} />
      </div>
      <Card>
        <p>
          <strong>{tournament.name}</strong>
        </p>
        <p>{t("intro")}</p>
      </Card>
      {metrics.verification.totalResults === 0 ? (
        <StateCard
          art="effects/wave"
          titleId="metrics-empty"
          title={t("empty.title")}
          body={t("empty.body")}
        />
      ) : (
        <MetricsOverview metrics={metrics} />
      )}
    </main>
  );
}
