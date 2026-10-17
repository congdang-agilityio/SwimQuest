import { getTranslations } from "next-intl/server";
import { UserSearch } from "@/components/admin/user-search";
import styles from "@/components/admin/admin.module.css";
import { ScreenHeader } from "@/components/ui";

/** Admin users list; the admin layout already refuses everyone else. */
export default async function AdminUsersPage() {
  const t = await getTranslations("admin.users");
  return (
    <main className={styles.screen}>
      <div className={styles.headerBand}>
        <ScreenHeader title={t("title")} backHref="/admin" backLabel={t("back")} />
      </div>
      <UserSearch />
    </main>
  );
}
