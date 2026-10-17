import { useLocale, useTranslations } from "next-intl";
import * as f from "@/lib/format/swim";
import { Card, Chip } from "@/components/ui";
import { DecisionNote } from "./decision-note";
import { CheckReasons } from "./check-reasons";
import { PointsBreakdown } from "./points-breakdown";
import { SwimFactRows, SwimHero, resultTone } from "./swim-facts";
import type { MySwimDto } from "@/server/swims/my-swims";
import styles from "./swims.module.css";

/** A swim with its status, points and reasons in each tournament (no swim-level status). */
export function SwimDetail({ swim }: { swim: MySwimDto }) {
  const ts = useTranslations("swims.summary");
  const tc = useTranslations("checks");
  const locale = useLocale() === "en" ? "en" : "vi";
  const rows: [string, string][] = [
    [ts("dateTime"), f.formatVnDateTime(swim.date, swim.startTime)],
    [ts("pace"), f.formatPace(swim.pacePer100mS)],
    [ts("type"), ts(`types.${swim.swimType}`)],
  ];
  return (
    <>
      <Card className={styles.summary}>
        <SwimHero
          distance={f.formatDistance(swim.distanceM, locale)}
          duration={f.formatDuration(swim.durationS)}
        />
        <SwimFactRows rows={rows} />
      </Card>
      <Card as="section" aria-labelledby="swim-results-title" className={styles.summary}>
        <h2 id="swim-results-title" className={styles.cardTitle}>
          {tc("title")}
        </h2>
        {swim.results.length === 0 ? (
          <p className={styles.muted}>{tc("noTournament")}</p>
        ) : (
          <ul className={styles.results}>
            {swim.results.map((r) => (
              <li key={r.tournamentId} className={styles.result}>
                <div className={styles.resultHead}>
                  <strong>{r.tournamentName}</strong>
                  <Chip tone={resultTone(r.status)}>{tc(`status.${r.status}`)}</Chip>
                </div>
                <PointsBreakdown points={r.points} />
                <DecisionNote status={r.status} note={r.decisionNote} decidedAt={r.decidedAt} />
                <CheckReasons reasons={r.reasons} rules={r.rules} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
