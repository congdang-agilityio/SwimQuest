import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { LanguageSwitch } from "@/components/i18n/language-switch";
import { MockupPicture } from "@/components/art/mockup-picture";
import styles from "./auth.module.css";

/**
 * Welcome screen shared by login and sign-up: the SwimQuest logo (cut art, alt = app name) with
 * the tagline, then the form on the deep-blue page. The stakeholder removed the sea hero and the
 * "Chào mừng đến với" line on 2026-10-18.
 * The brand is not a heading: each page's own h1 ("Đăng nhập", "Tạo tài khoản") names it.
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const [t, tc] = await Promise.all([getTranslations("auth"), getTranslations("common")]);
  return (
    <main className={styles.page}>
      <div className={styles.column}>
        <div className={styles.language}>
          <LanguageSwitch tone="dark" />
        </div>
        <div className={styles.brandBlock}>
          <p className={styles.brand}>
            <MockupPicture
              artKey="brand/logo"
              alt={tc("appName")}
              className={styles.logo}
              eager
              fallback={tc("appName")}
            />
          </p>
          <p className={styles.tagline}>{t("hero.tagline")}</p>
        </div>
        {children}
      </div>
    </main>
  );
}
