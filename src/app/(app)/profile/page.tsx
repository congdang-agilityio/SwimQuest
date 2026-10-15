import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LogoutButton } from "@/components/auth/logout-button";
import styles from "@/components/nav/app-nav.module.css";

export default async function ProfilePage() {
  const t = await getTranslations("nav");
  return (
    <main>
      <h1>{t("profile.title")}</h1>
      <p>
        <Link href="/swims" className={styles.tap}>
          {t("profile.mySwims")}
        </Link>
      </p>
      <LogoutButton />
    </main>
  );
}
