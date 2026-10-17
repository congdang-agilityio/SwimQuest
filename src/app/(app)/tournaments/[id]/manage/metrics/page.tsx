import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { FairnessTable } from "@/components/organizer/fairness-table";
import { MetricsOverview } from "@/components/organizer/metrics-overview";
import { AccessDenied } from "@/components/states/access-denied";
import { StateCard } from "@/components/states/state-card";
import manage from "@/components/tournaments/manage.module.css";
import { Card, ScreenHeader, Tabs } from "@/components/ui";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";
import { ForbiddenError, NotFoundError, requireOrganizer } from "@/server/auth/roles";
import { getFairness } from "@/server/organizer/fairness";
import { getTournamentMetrics } from "@/server/organizer/metrics";

export const dynamic = "force-dynamic";

/** Organizer Metrics (S-80): Overview, and Fairness with `?tab=fairness`. */
export default async function MetricsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const fairnessTab = (await searchParams).tab === "fairness";
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/tournaments");
  const tournament = await requireOrganizer(user.id, id).catch((err: unknown) => {
    if (err instanceof NotFoundError) notFound();
    if (err instanceof ForbiddenError) return null;
    throw err;
  });
  if (!tournament) return <AccessDenied />;
  const metrics = fairnessTab ? null : await getTournamentMetrics(user.id, tournament.id);
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
      <Tabs
        label={t("tabsLabel")}
        value={fairnessTab ? "fairness" : "overview"}
        items={[
          { id: "overview", label: t("tabs.overview"), href: base + "/metrics" },
          { id: "fairness", label: t("tabs.fairness"), href: base + "/metrics?tab=fairness" },
        ]}
      />
      {fairnessTab ? (
        <FairnessTable fairness={await getFairness(user.id, tournament.id)} />
      ) : metrics!.verification.totalResults === 0 ? (
        <StateCard
          art="effects/wave"
          titleId="metrics-empty"
          title={t("empty.title")}
          body={t("empty.body")}
        />
      ) : (
        <MetricsOverview metrics={metrics!} />
      )}
    </main>
  );
}
