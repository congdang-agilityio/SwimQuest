"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogoutButton } from "@/components/auth/logout-button";
import { isActive, navItems } from "./nav-items";
import styles from "./app-nav.module.css";

/**
 * Bottom bar below 768 px, left navigation from 768 px. The current tab carries
 * `aria-current="page"`, which the stylesheet also shows as bold text plus a bar (not colour alone).
 * The account menu is a closed `<details>`, so its logout button is not on the page until opened.
 */
export function AppNav({
  displayName,
  isPlatformAdmin,
}: {
  displayName: string;
  isPlatformAdmin: boolean;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <>
      <div className={styles.account}>
        <details>
          <summary aria-label={t("account")}>{displayName}</summary>
          <LogoutButton />
        </details>
      </div>
      <nav className={styles.nav} aria-label={t("label")}>
        <ul className={styles.list}>
          {navItems(isPlatformAdmin).map(({ key, href }) => (
            <li key={key}>
              <Link
                href={href}
                className={styles.link}
                aria-current={isActive(href, pathname) ? "page" : undefined}
              >
                {t(`items.${key}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
