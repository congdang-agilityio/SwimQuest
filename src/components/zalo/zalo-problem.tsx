"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Card } from "@/components/ui";
import styles from "./zalo.module.css";

export type ZaloProblemKind = "botRemoved" | "unreachable" | "keyUnreadable" | "webhook" | "other";

/** Plain-language kind of a stored delivery reason (the stored text is technical English). */
export function problemKindOf(reason: string): ZaloProblemKind {
  if (/Webhook not registered/i.test(reason)) return "webhook";
  if (/cannot be read/i.test(reason)) return "keyUnreadable";
  if (/Zalo error 403|not (in|a member of) (the |this )?group/i.test(reason)) return "botRemoved";
  if (/unreachable|timed? ?out|network|fetch failed/i.test(reason)) return "unreachable";
  return "other";
}

/**
 * The bot's last delivery problem with when it happened, in Vietnam time (S-89 AC 3). It goes
 * away once a later message is delivered, because delivery clears the stored problem.
 */
export function ZaloProblem({
  reason,
  at,
  failedCount,
}: {
  reason: string;
  at: string | null;
  failedCount: number;
}) {
  const t = useTranslations("zalo.problem");
  const format = useFormatter();
  const kind = problemKindOf(reason);
  return (
    <Card role="alert" className={styles.problem} data-testid="zalo-problem">
      <h2 className={styles.noticeTitle}>{t("title")}</h2>
      <p>{t(`kinds.${kind}`)}</p>
      {at && (
        <p className={styles.problemMeta}>
          {t("when", {
            date: format.dateTime(new Date(at), {
              day: "numeric",
              month: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
          })}
        </p>
      )}
      {failedCount > 0 && (
        <p className={styles.problemMeta}>{t("failedCount", { count: failedCount })}</p>
      )}
    </Card>
  );
}
