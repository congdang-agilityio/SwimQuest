import { getTranslations } from "next-intl/server";
import adminStyles from "@/components/admin/admin.module.css";
import filterStyles from "@/components/admin/audit.module.css";
import { FunnelSummary } from "@/components/admin/funnel-summary";
import { Button, ButtonLink, Field, ScreenHeader } from "@/components/ui";
import { vnLocalToUtc } from "@/lib/time/vn";
import { getPlatformMetrics } from "@/server/admin/platform-metrics";
import { getCurrentUser } from "@/server/auth/current-user";
import { requirePlatformAdmin } from "@/server/auth/roles";

type Params = Record<string, string | string[] | undefined>;
const DAY_MS = 24 * 3600_000;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const day = (v: string | undefined) => {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  try {
    return vnLocalToUtc(v, "00:00");
  } catch {
    return undefined;
  }
};

/** Admin Metrics: funnel counts and conversion for a range (default 30 days) and health signals. */
export default async function AdminMetricsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await getCurrentUser();
  requirePlatformAdmin(user);
  const params = await searchParams;
  const now = new Date();
  const fromDay = day(first(params.from));
  const toDay = day(first(params.to));
  // The "to" day is inclusive, so the range ends at the start of the next day.
  const to = toDay ? new Date(toDay.getTime() + DAY_MS) : new Date(now.getTime() + 1);
  const from = fromDay ?? new Date(to.getTime() - 30 * DAY_MS);
  const [t, metrics] = await Promise.all([
    getTranslations("admin.metrics"),
    getPlatformMetrics({ id: user?.id ?? "", isPlatformAdmin: true }, { from, to }, now),
  ]);
  return (
    <main className={adminStyles.screen}>
      <div className={adminStyles.headerBand}>
        <ScreenHeader title={t("title")} backHref="/admin" backLabel={t("back")} />
      </div>
      <form
        method="get"
        action="/admin/metrics"
        className={filterStyles.filters}
        aria-label={t("range.title")}
      >
        <Field
          id="metrics-from"
          name="from"
          type="date"
          label={t("range.from")}
          defaultValue={first(params.from) ?? ""}
        />
        <Field
          id="metrics-to"
          name="to"
          type="date"
          label={t("range.to")}
          defaultValue={first(params.to) ?? ""}
        />
        <div className={filterStyles.filterActions}>
          <Button type="submit">{t("range.apply")}</Button>
          <ButtonLink variant="ghost" href="/admin/metrics">
            {t("range.reset")}
          </ButtonLink>
        </div>
      </form>
      <FunnelSummary metrics={metrics} />
    </main>
  );
}
