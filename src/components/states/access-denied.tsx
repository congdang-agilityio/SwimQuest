import Link from "next/link";
import { useTranslations } from "next-intl";
import styles from "./states.module.css";

/** Shown when the user may not view a page; the home page is `/`. */
export function AccessDenied() {
  const t = useTranslations("states.accessDenied");
  return (
    <section>
      <h2>{t("title")}</h2>
      <p>{t("body")}</p>
      <Link href="/" className={styles.tap}>
        {t("home")}
      </Link>
    </section>
  );
}
