import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AdminContactForm } from "@/components/admin/admin-contact-form";
import adminStyles from "@/components/admin/admin.module.css";
import styles from "@/components/nav/app-nav.module.css";
import { getAdminContact } from "@/server/platform/admin-contact";

/** Admin sections; later admin tasks add their entry here. */
const SECTIONS = [
  { key: "users", href: "/admin/users" },
  { key: "swimLimits", href: "/admin/swim-limits" },
  { key: "reports", href: "/admin/reports" },
  { key: "tournamentRequests", href: "/admin/tournament-requests" },
  { key: "audit", href: "/admin/audit" },
] as const;

export default async function AdminPage() {
  const t = await getTranslations("admin");
  const contact = await getAdminContact();
  return (
    <main className={adminStyles.screen}>
      <h1>{t("title")}</h1>
      <ul>
        {SECTIONS.map(({ key, href }) => (
          <li key={key}>
            <Link href={href} className={styles.tap}>
              {t(`sections.${key}`)}
            </Link>
          </li>
        ))}
      </ul>
      <AdminContactForm initial={contact} />
    </main>
  );
}
