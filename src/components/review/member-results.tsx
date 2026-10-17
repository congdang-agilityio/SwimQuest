import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { resultTone } from "@/components/swims/swim-facts";
import { Card, Chip } from "@/components/ui";
import * as f from "@/lib/format/swim";
import { utcToVnParts } from "@/lib/time/vn";
import type { MemberResult } from "@/server/review/member-results";
import styles from "./review.module.css";

/**
 * A member's results in the tournament: date, distance, status and points. When `resultHref` is
 * given, each row opens the result page (the review page with Revoke, #311).
 */
export function MemberResults({
  results,
  resultHref,
}: {
  results: readonly MemberResult[];
  resultHref?: (resultId: string) => string;
}) {
  const t = useTranslations("review.member");
  const tc = useTranslations("checks");
  const locale = useLocale() === "en" ? "en" : "vi";
  if (results.length === 0) {
    return (
      <Card as="section" aria-labelledby="member-empty" className={styles.intro}>
        <h2 id="member-empty" className={styles.sectionTitle}>
          {t("empty")}
        </h2>
      </Card>
    );
  }
  return (
    <ul className={styles.list}>
      {results.map((r) => {
        const { date, time } = utcToVnParts(new Date(r.startedAt));
        const body = (
          <>
            <span className={styles.rowMain}>
              <span className={styles.rowDate}>{f.formatVnDateTime(date, time)}</span>
              <Chip tone={resultTone(r.status)} className={styles.rowStatus}>
                {tc(`status.${r.status}`)}
              </Chip>
            </span>
            <span className={styles.rowFigures}>
              <strong className={styles.rowDistance}>
                {f.formatDistance(r.distanceM, locale)}
              </strong>
              <span className={styles.rowPoints}>{t("points", { points: r.points })}</span>
            </span>
          </>
        );
        return (
          <li key={r.resultId}>
            {resultHref ? (
              <Link href={resultHref(r.resultId)} className={styles.resultRow}>
                {body}
              </Link>
            ) : (
              <div className={styles.resultRow}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
