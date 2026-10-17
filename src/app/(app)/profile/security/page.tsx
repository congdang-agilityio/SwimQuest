import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { ChangePasswordForm } from "@/components/profile/change-password-form";
import { Card, ScreenHeader } from "@/components/ui";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";
import styles from "./security.module.css";

export default async function SecurityPage() {
  await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/profile/security");
  const [t, common] = await Promise.all([getTranslations("security"), getTranslations("common")]);
  return (
    <main className={styles.page}>
      <div className={styles.headerBand}>
        <ScreenHeader title={t("title")} backHref="/profile" backLabel={common("back")} />
      </div>

      <Card as="section" className={styles.card} aria-labelledby="sec-login">
        <h2 id="sec-login" className={styles.heading}>
          {t("login.title")}
        </h2>
        <p className={styles.text}>{t("login.method")}</p>
      </Card>

      <Card as="section" className={styles.card} aria-labelledby="sec-change">
        <h2 id="sec-change" className={styles.heading}>
          {t("change.title")}
        </h2>
        <ChangePasswordForm />
      </Card>

      <Card as="section" className={styles.card} aria-labelledby="sec-recovery">
        <h2 id="sec-recovery" className={styles.heading}>
          {t("recovery.title")}
        </h2>
        <p className={styles.text}>{t("recovery.body")}</p>
      </Card>
    </main>
  );
}
