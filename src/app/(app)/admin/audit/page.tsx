import { getTranslations } from "next-intl/server";
import { AuditFilters } from "@/components/admin/audit-filters";
import { AuditTable } from "@/components/admin/audit-table";
import styles from "@/components/admin/audit.module.css";
import adminStyles from "@/components/admin/admin.module.css";
import { EmptyState } from "@/components/states/empty-state";
import { ButtonLink, ScreenHeader } from "@/components/ui";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/auth/current-user";
import { requirePlatformAdmin } from "@/server/auth/roles";
import {
  listAuditActions,
  listAuditEvents,
  type AuditFilters as Filters,
} from "@/server/admin/audit-log";

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const day = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

/** Admin audit log, newest first; filters and the paging cursor live in the URL. */
export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await getCurrentUser();
  requirePlatformAdmin(user);
  const admin = { id: user?.id ?? "", isPlatformAdmin: true };
  const params = await searchParams;
  const actions = [params.action ?? []].flat().filter(Boolean);
  const filters: Filters = {
    tournamentId: first(params.tournament),
    userId: first(params.user),
    actions: actions.length ? actions : undefined,
    from: day(first(params.from)),
    to: day(first(params.to)),
  };
  const cursor = first(params.cursor);
  const t = await getTranslations("admin.audit");
  const [page, actionNames, tournaments] = await Promise.all([
    listAuditEvents(admin, filters, cursor).catch(() => listAuditEvents(admin, filters)),
    listAuditActions(admin),
    db.tournament.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const kept = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === "cursor") continue;
    for (const item of [v ?? []].flat()) if (item) kept.append(k, item);
  }
  const next = page.nextCursor ? new URLSearchParams(kept) : null;
  next?.set("cursor", page.nextCursor ?? "");
  return (
    <main className={adminStyles.screen}>
      <div className={adminStyles.headerBand}>
        <ScreenHeader title={t("title")} backHref="/admin" backLabel={t("back")} />
      </div>
      <AuditFilters
        tournaments={tournaments}
        actions={actionNames}
        values={{
          tournament: filters.tournamentId ?? "",
          user: filters.userId ?? "",
          action: filters.actions?.[0] ?? "",
          from: filters.from ?? "",
          to: filters.to ?? "",
        }}
      />
      {page.items.length ? <AuditTable events={page.items} /> : <EmptyState message={t("empty")} />}
      {next && (
        <div className={styles.more}>
          <ButtonLink variant="secondary" href={`/admin/audit?${next}`}>
            {t("older")}
          </ButtonLink>
        </div>
      )}
    </main>
  );
}
