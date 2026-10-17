import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { MockupPicture } from "@/components/art/mockup-picture";
import styles from "./console.module.css";
import manage from "@/components/tournaments/manage.module.css";
import { Card, Chip, ScreenHeader, type ChipTone } from "@/components/ui";
import type { TournamentStatus } from "@/lib/tournaments/lifecycle";
import { formatVnDateTime, utcToVnParts } from "@/lib/time/vn";
import type { ConsoleTimeline } from "@/server/organizer/console";

const STATUS_TONE: Record<TournamentStatus, ChipTone> = {
  DRAFT: "neutral",
  PUBLISHED: "info",
  ACTIVE: "success",
  COMPLETED: "gold",
  ARCHIVED: "neutral",
};

const TIMELINE: (keyof ConsoleTimeline)[] = [
  "publishedAt",
  "seasonStartAt",
  "startChoiceLocksAt",
  "seasonEndAt",
  "uploadWindowEndsAt",
];

type Props = {
  name: string;
  status: TournamentStatus;
  timeline: ConsoleTimeline;
  now: Date;
  backLabel: string;
  /** The publish or archive control allowed in this state (rendered by the page). */
  controls?: ReactNode;
  /** Buttons under the timeline (settings, review). */
  actions?: ReactNode;
};

const when = (d: Date) => {
  const { date, time } = utcToVnParts(d);
  return `${time} ${date}`;
};

/** Top of the organizer console (S-65 AC 2): status, Vietnam-time timeline and allowed controls. */
export function ConsoleHeader({
  name,
  status,
  timeline,
  now,
  backLabel,
  controls,
  actions,
}: Props) {
  const t = useTranslations("organizer");
  const next = TIMELINE.find((key) => {
    const at = timeline[key];
    return at !== null && at.getTime() > now.getTime();
  });
  return (
    <>
      <div className={manage.headerBand}>
        <ScreenHeader title={name} backHref="/tournaments" backLabel={backLabel} />
      </div>
      <Card as="section" aria-labelledby="console-status" className={styles.header} data-wide-span>
        {/* The route's sea scene, as on the mockup's tournament cards (G1 art). */}
        <div className={styles.hero}>
          <MockupPicture
            artKey="scenes/sea-ly-son-16x9"
            alt=""
            className={styles.scene}
            eager
            fallback={<div className={styles.sceneFallback} />}
          />
          <p className={styles.statusRow}>
            <span>{t("manage.status")}:</span>
            <Chip tone={STATUS_TONE[status]}>{t(`manage.statusNames.${status}`)}</Chip>
          </p>
        </div>
        <div className={styles.headerBody}>
          <h2 id="console-status" className={styles.headerTitle}>
            {t("console.timelineTitle")}
          </h2>
          <p id="season" className={styles.meta}>
            <span className={styles.metaLabel}>{t("manage.season")}:</span>{" "}
            {when(timeline.seasonStartAt)} - {when(timeline.seasonEndAt)} ({t("manage.vietnamTime")}
            )
          </p>
          <ol className={styles.timeline}>
            {TIMELINE.map((key) => {
              const at = timeline[key];
              const state =
                at === null ? "pending" : at.getTime() <= now.getTime() ? "past" : "future";
              return (
                <li
                  key={key}
                  className={styles.step}
                  data-state={state}
                  data-next={key === next ? "true" : undefined}
                >
                  <span className={styles.dot} aria-hidden="true" />
                  <span className={styles.stepLabel}>{t(`console.timeline.${key}`)}</span>
                  <span className={styles.stepWhen}>
                    {at ? formatVnDateTime(at) : t("console.notYet")}
                  </span>
                  <span className={styles.stepState}>{t(`console.state.${state}`)}</span>
                </li>
              );
            })}
          </ol>
          {actions}
        </div>
        {controls && <div className={styles.controls}>{controls}</div>}
      </Card>
    </>
  );
}
