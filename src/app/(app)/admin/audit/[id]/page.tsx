import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import adminStyles from "@/components/admin/admin.module.css";
import { AuditDiff } from "@/components/admin/audit-diff";
import { auditActionLabel, auditEntityLabel } from "@/components/admin/audit-labels";
import styles from "@/components/admin/audit.module.css";
import { ScreenHeader } from "@/components/ui";
import { formatVnDateTime } from "@/lib/time/vn";
import { getAuditEvent } from "@/server/admin/audit-log";
import { getCurrentUser } from "@/server/auth/current-user";
import { NotFoundError, requirePlatformAdmin } from "@/server/auth/roles";

/** One audit event with its old and new values. Read only; the admin layout guards access. */
export default async function AuditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  requirePlatformAdmin(user);
  const { id } = await params;
  const event = await getAuditEvent({ id: user?.id ?? "", isPlatformAdmin: true }, id).catch(
    (err) => {
      if (err instanceof NotFoundError) notFound();
      throw err;
    },
  );
  const t = await getTranslations("admin.audit");
  const facts: [string, string][] = [
    [t("cols.action"), auditActionLabel(t, event.action)],
    [t("cols.actor"), event.actor?.displayName ?? t("system")],
    [
      t("cols.target"),
      `${auditEntityLabel(t, event.entityType)}${event.targetLabel ? `: ${event.targetLabel}` : ""} (${event.entityId})`,
    ],
    [t("cols.time"), formatVnDateTime(new Date(event.createdAt))],
    [t("cols.reason"), event.reason ?? "-"],
  ];
  return (
    <main className={adminStyles.screen}>
      <div className={adminStyles.headerBand}>
        <ScreenHeader title={t("detail.title")} backHref="/admin/audit" backLabel={t("back")} />
      </div>
      <section className={styles.panel} aria-label={t("detail.title")}>
        <dl className={styles.facts}>
          {facts.map(([label, value]) => (
            <div key={label} className={styles.fact}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <AuditDiff before={event.before} after={event.after} />
    </main>
  );
}
