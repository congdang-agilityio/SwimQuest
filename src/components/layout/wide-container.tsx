import type { ReactNode } from "react";
import styles from "./wide-container.module.css";

/** Widens the app shell sheet from 1024 px for organizer and admin pages; phones are unchanged. */
export function WideContainer({ children }: { children: ReactNode }) {
  return <div className={styles.wide}>{children}</div>;
}
