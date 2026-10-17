import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { PrivacyForm } from "@/components/profile/privacy-form";
import { ButtonLink, Card, ScreenHeader } from "@/components/ui";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { PRIVACY_LEVELS } from "@/lib/privacy";
import { requireUser } from "@/server/auth/current-user";
import { getPrivacy } from "@/server/profile/privacy";
import styles from "./privacy.module.css";

export default async function PrivacyPage() {
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/profile/privacy");
  const [t, common, privacy] = await Promise.all([
    getTranslations("privacy"),
    getTranslations("common"),
    getPrivacy(user.id),
  ]);
  return (
    <main className={styles.page}>
      <div className={styles.headerBand}>
        <ScreenHeader title={t("title")} backHref="/profile" backLabel={common("back")} />
      </div>

      <Card as="section" className={styles.card} aria-labelledby="priv-fields">
        <h2 id="priv-fields" className={styles.heading}>
          {t("fields.title")}
        </h2>
        {privacy ? (
          <PrivacyForm initial={privacy} />
        ) : (
          <p className={styles.text}>{t("loadFailed")}</p>
        )}
      </Card>

      <Card as="section" className={styles.card} aria-labelledby="priv-levels">
        <h2 id="priv-levels" className={styles.heading}>
          {t("explain.title")}
        </h2>
        <ul className={styles.levels}>
          {PRIVACY_LEVELS.map((level) => (
            <li key={level}>
              <strong>{t(`levels.${level}`)}</strong>: {t(`explain.${level}`)}
            </li>
          ))}
        </ul>
      </Card>

      <Card as="section" className={styles.card} aria-labelledby="priv-email">
        <h2 id="priv-email" className={styles.heading}>
          {t("email.title")}
        </h2>
        <p className={styles.text}>{t("email.note")}</p>
      </Card>

      <Card as="section" className={styles.card} aria-labelledby="priv-preview">
        <h2 id="priv-preview" className={styles.heading}>
          {t("preview.title")}
        </h2>
        <p className={styles.text}>{t("preview.body")}</p>
        <ButtonLink href={`/players/${user.id}?preview=1`} variant="secondary" block>
          {t("preview.link")}
        </ButtonLink>
      </Card>
    </main>
  );
}
