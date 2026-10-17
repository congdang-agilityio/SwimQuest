import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatVnDateTime } from "@/lib/time/vn";
import type { AuditEventRow } from "@/server/admin/audit-log";
import { auditActionLabel, auditEntityLabel } from "./audit-labels";
import styles from "./audit.module.css";

/** Audit events newest first. Read only: each row only links to its detail page. */
export async function AuditTable({ events }: { events: AuditEventRow[] }) {
  const t = await getTranslations("admin.audit");
  return (
    <div className={styles.panel}>
      <table className={styles.table}>
        <caption className={styles.srOnly}>{t("title")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("cols.time")}</th>
            <th scope="col">{t("cols.actor")}</th>
            <th scope="col">{t("cols.action")}</th>
            <th scope="col">{t("cols.target")}</th>
            <th scope="col">{t("cols.reason")}</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <td data-label={t("cols.time")}>
                <Link href={`/admin/audit/${e.id}`} className={styles.open}>
                  {formatVnDateTime(new Date(e.createdAt))}
                </Link>
              </td>
              <td data-label={t("cols.actor")}>{e.actor?.displayName ?? t("system")}</td>
              <td data-label={t("cols.action")}>
                <strong>{auditActionLabel(t, e.action)}</strong>
              </td>
              <td data-label={t("cols.target")}>
                {auditEntityLabel(t, e.entityType)}
                {e.targetLabel ? `: ${e.targetLabel}` : ""}
                <span className={styles.id}>{e.entityId}</span>
              </td>
              <td data-label={t("cols.reason")}>{e.reason ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
