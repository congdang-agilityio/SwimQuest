import Link from "next/link";
import { useTranslations } from "next-intl";
import styles from "@/components/nav/app-nav.module.css";

/** Shown to a user who is in no tournament: how to join, plus the "Create tournament" button. */
export function JoinGuidance() {
  const t = useTranslations("tabs.joinGuidance");
  return (
    <section aria-labelledby="join-guidance-title">
      <h2 id="join-guidance-title">{t("title")}</h2>
      <p>{t("body")}</p>
      <Link href="/tournaments/new" className={styles.tap}>
        {t("create")}
      </Link>
    </section>
  );
}
