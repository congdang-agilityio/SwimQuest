import { useLocale, useTranslations } from "next-intl";
import { SwimFactRows } from "@/components/swims/swim-facts";
import { Avatar, Card, Chip } from "@/components/ui";
import * as f from "@/lib/format/swim";
import { utcToVnParts } from "@/lib/time/vn";
import type { ReviewItem as Item, ReviewReason } from "@/server/review/queue";
import { DecisionDialog } from "./decision-dialog";
import { TrackShape } from "./track-shape";
import styles from "./review.module.css";

const KNOWN = [
  "PACE_TOO_FAST",
  "PACE_TOO_SLOW",
  "DISTANCE_TOO_LONG",
  "OUTSIDE_SEASON",
  "NO_DISTANCE",
  "NOT_A_SWIM",
];

const dmy = (date: string) => date.split("-").reverse().join("/");
const vnDateTime = (iso: string) => {
  const { date, time } = utcToVnParts(new Date(iso));
  return f.formatVnDateTime(date, time);
};
const num = (v: unknown) => (typeof v === "number" ? v : Number(v));

/** The limit and the swim's value of a failed check, in display units. */
function reasonValues(r: ReviewReason, locale: "vi" | "en"): Record<string, string> {
  switch (r.code) {
    case "PACE_TOO_FAST":
    case "PACE_TOO_SLOW":
      return { limit: f.formatDuration(num(r.limit)), value: f.formatPace(num(r.value)) };
    case "DISTANCE_TOO_LONG":
      return {
        limit: f.formatDistance(num(r.limit), locale),
        value: f.formatDistance(num(r.value), locale),
      };
    case "OUTSIDE_SEASON": {
      const season = r.limit as { seasonStartAt: string; seasonEndAt: string };
      return {
        start: vnDateTime(season.seasonStartAt),
        end: vnDateTime(season.seasonEndAt),
        value: vnDateTime(String(r.value)),
      };
    }
    case "NO_DISTANCE":
      return { value: f.formatDistance(num(r.value), locale) };
    default:
      return { value: String(r.value ?? "-") };
  }
}

/** One flagged swim for a reviewer: player, facts, failed checks, its shape and the decision. */
export function ReviewItem({ item }: { item: Item }) {
  const t = useTranslations("review");
  const ts = useTranslations("swims.summary");
  const locale = useLocale() === "en" ? "en" : "vi";
  const name = item.player.displayName;
  const titleId = `review-${item.resultId}`;
  const rows: [string, string][] = [
    [t("item.date"), dmy(item.date)],
    [t("item.distance"), f.formatDistance(item.distanceM, locale)],
    [t("item.duration"), f.formatDuration(item.durationS)],
    [t("item.pace"), f.formatPace(item.pacePer100mS)],
    [t("item.type"), ts(`types.${item.swimType}`)],
  ];
  return (
    <Card as="article" aria-labelledby={titleId} className={styles.item}>
      <div className={styles.itemHead}>
        <Avatar name={name} decorative />
        <h2 id={titleId} className={styles.player}>
          {name}
        </h2>
        <Chip tone="warning">{item.dispute ? t("item.disputed") : t("item.flagged")}</Chip>
      </div>
      <div className={styles.body}>
        <TrackShape track={item.track} label={t("item.shape")} emptyLabel={t("item.noShape")} />
        <SwimFactRows rows={rows} />
      </div>
      {item.dispute && (
        <div className={styles.dispute}>
          <h3 className={styles.reasonsTitle}>{t("item.disputeReason")}</h3>
          <p className={styles.disputeText}>{item.dispute.reason}</p>
          <p className={styles.disputeBefore}>
            {t("item.earlier", { status: t(`item.status.${item.dispute.previousStatus}`) })}
          </p>
        </div>
      )}
      {item.reasons.length > 0 && (
        <div className={styles.reasons}>
          <h3 className={styles.reasonsTitle}>{t("item.failed")}</h3>
          <ul>
            {item.reasons.map((r) => (
              <li key={r.code}>
                <Chip tone="danger" className={styles.reasonChip}>
                  {KNOWN.includes(r.code)
                    ? t(`reasons.${r.code}`, reasonValues(r, locale))
                    : t("reasons.UNKNOWN", { code: r.code })}
                </Chip>
              </li>
            ))}
          </ul>
        </div>
      )}
      <DecisionDialog resultId={item.resultId} playerName={name} disputeId={item.dispute?.id} />
    </Card>
  );
}
