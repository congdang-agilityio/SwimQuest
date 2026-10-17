import { getTranslations } from "next-intl/server";
import styles from "@/components/admin/admin.module.css";
import { SwimLimitsForm } from "@/components/admin/swim-limits-form";
import { ScreenHeader } from "@/components/ui";
import { getSwimLimitConfig } from "@/server/platform/swim-limits-config";

export const dynamic = "force-dynamic";

/** Admin swim limits page; the admin layout already refuses everyone else. */
export default async function AdminSwimLimitsPage() {
  const t = await getTranslations("admin.swimLimits");
  const config = await getSwimLimitConfig();
  return (
    <main className={styles.screen}>
      <div className={styles.headerBand}>
        <ScreenHeader title={t("title")} backHref="/admin" backLabel={t("back")} />
      </div>
      <section className={styles.panel}>
        <SwimLimitsForm initial={config} />
      </section>
    </main>
  );
}
