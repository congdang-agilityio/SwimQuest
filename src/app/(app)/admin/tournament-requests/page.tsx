import { getTranslations } from "next-intl/server";
import styles from "@/components/admin/admin.module.css";
import { QuotaRequests } from "@/components/admin/quota-requests";
import { ScreenHeader } from "@/components/ui";

/** Admin "Tournament requests" queue; the admin layout already refuses everyone else. */
export default async function AdminTournamentRequestsPage() {
  const t = await getTranslations("admin.tournamentRequests");
  return (
    <main className={styles.screen}>
      <div className={styles.headerBand}>
        <ScreenHeader title={t("title")} backHref="/admin" backLabel={t("back")} />
      </div>
      <QuotaRequests />
    </main>
  );
}
