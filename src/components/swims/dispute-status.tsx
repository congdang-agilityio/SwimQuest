import { useTranslations } from "next-intl";
import type { MySwimResultDto } from "@/server/swims/my-swims";
import { vnDateTime } from "./decision-note";
import styles from "./swims.module.css";

/** An open dispute's status, or the outcome of the last decided one, in the decision card style. */
export function DisputeStatus({
  open,
  last,
}: {
  open: MySwimResultDto["openDispute"];
  last: MySwimResultDto["lastDispute"];
}) {
  const t = useTranslations("my-swims.detail.dispute");
  if (open) {
    return (
      <section className={`${styles.decision} ${styles.decisionInfo}`} aria-label={t("openTitle")}>
        <h3 className={styles.decisionTitle}>{t("openTitle")}</h3>
        <p className={styles.decisionText}>{t("openText")}</p>
        <p className={styles.decisionText}>{t("yourReason", { reason: open.reason })}</p>
        <p className={styles.decisionDate}>{t("sentAt", { date: vnDateTime(open.createdAt) })}</p>
      </section>
    );
  }
  if (!last) return null;
  const tone = last.accepted ? styles.decisionGood : "";
  return (
    <section
      className={`${styles.decision} ${tone}`}
      aria-label={t(last.accepted ? "acceptedTitle" : "keptTitle")}
    >
      <h3 className={styles.decisionTitle}>{t(last.accepted ? "acceptedTitle" : "keptTitle")}</h3>
      {last.note ? <p className={styles.decisionText}>{last.note}</p> : null}
      <p className={styles.decisionText}>{t("yourReason", { reason: last.reason })}</p>
      {last.decidedAt ? (
        <p className={styles.decisionDate}>
          {t("decidedAt", { date: vnDateTime(last.decidedAt) })}
        </p>
      ) : null}
    </section>
  );
}
