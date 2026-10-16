import Link from "next/link";
import { getTranslations } from "next-intl/server";
import styles from "@/components/nav/app-nav.module.css";

/** Admin sections; later admin tasks add their entry here. */
const SECTIONS = [{ key: "users", href: "/admin/users" }] as const;

export default async function AdminPage() {
  const t = await getTranslations("admin");
  return (
    <main>
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
    </main>
  );
}
