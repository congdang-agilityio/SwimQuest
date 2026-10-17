import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./ui.module.css";

type ScreenHeaderProps = {
  title: ReactNode;
  /** Where the back chevron goes; omit to hide it. */
  backHref?: string;
  /** Accessible name of the back link, from messages (common.back). */
  backLabel?: string;
  /** Optional control on the right (settings, share). */
  action?: ReactNode;
  id?: string;
};

/** Phone-screen header from the mockup: back chevron, centred bold title, optional action. */
export function ScreenHeader({ title, backHref, backLabel, action, id }: ScreenHeaderProps) {
  return (
    <header className={styles.screenHeader}>
      {backHref ? (
        <Link href={backHref} className={styles.back} aria-label={backLabel}>
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M15 5l-7 7 7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      ) : (
        <span />
      )}
      <h1 id={id} className={styles.screenTitle}>
        {title}
      </h1>
      <span className={styles.headerAction}>{action}</span>
    </header>
  );
}
