import { getTranslations } from "next-intl/server";
import styles from "@/components/admin/admin.module.css";
import { ReportsList } from "@/components/admin/reports-list";
import { ScreenHeader } from "@/components/ui";

/** Admin reports queue; the admin layout already refuses everyone else. */
export default async function AdminReportsPage() {
  const t = await getTranslations("admin.reports");
  return (
    <main className={styles.screen}>
      <div className={styles.headerBand}>
        <ScreenHeader title={t("title")} backHref="/admin" backLabel={t("back")} />
      </div>
      <ReportsList />
    </main>
  );
}
