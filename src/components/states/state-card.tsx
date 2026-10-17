import type { ReactNode } from "react";
import { Card } from "@/components/ui";
import { mockupArt } from "@/lib/art/mockup-art";
import styles from "./states.module.css";

/**
 * Shared look of the loading, error, not-found and access-denied states: a light card with
 * a registry illustration, a title, an optional line of text and one action. The art is decorative.
 */
export function StateCard({
  art,
  title,
  body,
  children,
  role,
  titleId,
}: {
  /** Registry key, e.g. `effects/wave` or `items/message-bottle`. */
  art: string;
  title: ReactNode;
  body?: ReactNode;
  children?: ReactNode;
  role?: "alert" | "status";
  titleId: string;
}) {
  const src = mockupArt(art)?.webp;
  return (
    <Card as="section" className={styles.card} role={role} aria-labelledby={titleId}>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element -- static art, no optimisation needed
        <img src={src} alt="" className={styles.art} />
      )}
      <h2 id={titleId} className={styles.title}>
        {title}
      </h2>
      {body && <p className={styles.body}>{body}</p>}
      {children}
    </Card>
  );
}
