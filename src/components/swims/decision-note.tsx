import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { utcToVnParts } from "@/lib/time/vn";
import styles from "./swims.module.css";

/** "dd/mm/yyyy HH:mm" in Vietnam time. */
export function vnDateTime(iso: string): string {
  const { date, time } = utcToVnParts(new Date(iso));
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y} ${time}`;
}

/**
 * The reviewer's reason for a rejected or revoked result, in a card under the status chip. Only
 * the owner's swim page gets the note. The dispute action sits in `.decisionActions`.
 */
export const showsDecisionNote = (status: string, note: string | null) =>
  (status === "REJECTED" || status === "REVOKED") && !!note;

export function DecisionNote({
  status,
  note,
  decidedAt,
  children,
}: {
  status: string;
  note: string | null;
  decidedAt: string | null;
  children?: ReactNode;
}) {
  const t = useTranslations("my-swims.detail.decision");
  if (!showsDecisionNote(status, note)) return null;
  return (
    <section className={styles.decision} aria-label={t("title")}>
      <h3 className={styles.decisionTitle}>{t("title")}</h3>
      <p className={styles.decisionText}>{note}</p>
      {decidedAt ? (
        <p className={styles.decisionDate}>{t("decidedAt", { date: vnDateTime(decidedAt) })}</p>
      ) : null}
      {children ? <div className={styles.decisionActions}>{children}</div> : null}
    </section>
  );
}
