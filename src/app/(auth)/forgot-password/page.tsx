import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui";
import { getAdminContact } from "@/server/platform/admin-contact";
import styles from "../auth.module.css";

/** The contact is a platform setting the admin can change at any time. */
export const dynamic = "force-dynamic";

/**
 * Forgot-password help (S-59 AC 1), public: a platform admin resets passwords, here is how to
 * reach them, and no email is sent. Without a contact a general hint shows instead.
 */
export default async function ForgotPasswordPage() {
  const [t, contact] = await Promise.all([getTranslations("auth.forgot"), getAdminContact()]);
  return (
    <section aria-labelledby="forgot-title" className={styles.form}>
      <h1 id="forgot-title" className={styles.title}>
        {t("title")}
      </h1>
      <p className={styles.help}>{t("intro")}</p>
      <div className={styles.contactCard}>
        <h2 className={styles.contactLabel}>{t("contactTitle")}</h2>
        {contact ? (
          <p className={styles.contact}>{contact}</p>
        ) : (
          <p className={styles.help}>{t("noContact")}</p>
        )}
      </div>
      <p className={styles.help}>{t("noEmail")}</p>
      <ButtonLink href="/login" block>
        {t("back")}
      </ButtonLink>
    </section>
  );
}
