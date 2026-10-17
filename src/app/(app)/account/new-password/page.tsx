import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LogoutButton } from "@/components/auth/logout-button";
import { Card } from "@/components/ui";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { NEW_PASSWORD_PATH, requireUser } from "@/server/auth/current-user";
import styles from "../../profile/security/security.module.css";
import { NewPasswordForm } from "./new-password-form";

/**
 * Forced password change after an admin reset (S-59 AC 3): the temporary password is the
 * "current" one. Once changed, the flag is cleared and the player goes Home.
 */
export default async function NewPasswordPage() {
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? NEW_PASSWORD_PATH);
  if (!user.mustChangePassword) redirect("/");
  const t = await getTranslations("security.forced");
  return (
    <main className={styles.page}>
      <Card as="section" className={styles.card} aria-labelledby="new-password-title">
        <h1 id="new-password-title" className={styles.heading}>
          {t("title")}
        </h1>
        <p className={styles.text}>{t("intro", { name: user.displayName })}</p>
        <NewPasswordForm />
      </Card>
      <Card as="section" className={styles.card} aria-label={t("logoutLabel")}>
        <p className={styles.text}>{t("logoutHint")}</p>
        <LogoutButton block />
      </Card>
    </main>
  );
}
