"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { Avatar } from "@/components/ui";
import { NavIcon } from "./nav-icon";
import { TournamentSwitcher } from "./tournament-switcher";
import type { TournamentSwitcherData } from "@/server/home/selected-tournament";
import { isActive, navItems } from "./nav-items";
import styles from "./app-nav.module.css";

/**
 * App shell chrome: a top bar with the brand and the account menu, and the main navigation
 * (bottom bar below 768 px, left rail from 768 px). The current tab has aria-current.
 */
type Props = {
  displayName: string;
  isPlatformAdmin: boolean;
  /** Two or more active tournaments: the switcher shows in the left rail from 768 px. */
  switcher?: TournamentSwitcherData | null;
  /** Notification bell (server-rendered), shown beside the account menu. */
  bell?: ReactNode;
};

export function AppNav({ displayName, isPlatformAdmin, switcher, bell }: Props) {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const pathname = usePathname();
  return (
    <>
      <div className={styles.topBar}>
        <span className={styles.brand}>{tc("appName")}</span>
        <div className={styles.actions}>
          {bell}
          <details className={styles.account}>
            <summary className={styles.accountSummary}>
              <Avatar name={displayName} size={32} decorative />
              {displayName}
            </summary>
            <div className={styles.menu} data-surface="light">
              <Link
                href="/profile"
                className={styles.menuLink}
                onClick={(e) => e.currentTarget.closest("details")?.removeAttribute("open")}
              >
                {t("account.myProfile")}
              </Link>
              <LogoutButton />
            </div>
          </details>
        </div>
      </div>
      <nav className={styles.nav} aria-label={t("label")}>
        {switcher && <TournamentSwitcher {...switcher} placement="rail" />}
        <ul className={styles.list}>
          {navItems(isPlatformAdmin).map(({ key, href }) => (
            <li key={key}>
              <Link
                href={href}
                className={styles.link}
                aria-current={isActive(href, pathname) ? "page" : undefined}
              >
                <NavIcon name={key} />
                <span>{t(`items.${key}`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
