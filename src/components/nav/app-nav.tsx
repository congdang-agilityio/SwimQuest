"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogoutButton } from "@/components/auth/logout-button";
import { isActive, navItems } from "./nav-items";
import styles from "./app-nav.module.css";

/** Bottom bar below 768 px, left navigation from 768 px; the current tab has aria-current. */
type Props = { displayName: string; isPlatformAdmin: boolean };

export function AppNav({ displayName, isPlatformAdmin }: Props) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <>
      <div className={styles.account}>
        <details>
          <summary className={styles.tap}>{displayName}</summary>
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
