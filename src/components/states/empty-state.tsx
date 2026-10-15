import Link from "next/link";
import styles from "./states.module.css";

export type EmptyStateAction =
  | { label: string; href: string; onClick?: never }
  | { label: string; onClick: () => void; href?: never };

/** A friendly empty list: message plus one next-step action. Texts are passed in (already localized). */
export function EmptyState({ message, action }: { message: string; action?: EmptyStateAction }) {
  return (
    <section>
      <h2>{message}</h2>
      {action &&
        (action.href !== undefined ? (
          <Link href={action.href} className={styles.tap}>
            {action.label}
          </Link>
        ) : (
          <button type="button" className={styles.tap} onClick={action.onClick}>
            {action.label}
          </button>
        ))}
    </section>
  );
}
