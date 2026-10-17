import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import * as f from "@/lib/format/swim";
import { ButtonLink, Card, Chip } from "@/components/ui";
import { CheckReasons } from "./check-reasons";
import { SwimFactRows, SwimHero, resultTone, swimTone } from "./swim-facts";
import type { OwnerSwimDto } from "@/server/swims/swim-dto";
import styles from "./swims.module.css";

const ICONS: Record<string, string> = { VERIFIED: "✓", FLAGGED: "⚠", DUPLICATE: "⧉" };

export function SwimSummary({ swim }: { swim: OwnerSwimDto }) {
  const t = useTranslations("swims.summary");
  const tc = useTranslations("checks");
  const locale = useLocale() === "en" ? "en" : "vi";
  const status = f.swimStatus(swim);
  const rows: [string, ReactNode][] = [
    [t("dateTime"), f.formatVnDateTime(swim.date, swim.startTime)],
    [t("pace"), f.formatPace(swim.pacePer100mS)],
    [t("type"), t(`types.${swim.swimType}`)],
    [
      t("status"),
      <Chip key="status" tone={swimTone(status)}>
        {t(`statuses.${status}`)}
      </Chip>,
    ],
  ];
  return (
    <Card as="section" aria-labelledby="swim-summary-title" className={styles.summary}>
      <h2 id="swim-summary-title" className={styles.cardTitle}>
        {t("title")}
      </h2>
      <SwimHero
        distance={f.formatDistance(swim.distanceM, locale)}
        duration={f.formatDuration(swim.durationS)}
      />
      <SwimFactRows rows={rows} />
      <h3 className={styles.cardTitle}>{tc("title")}</h3>
      {swim.results.length === 0 ? (
        <p className={styles.muted}>{tc("noTournament")}</p>
      ) : (
        <ul className={styles.results}>
          {swim.results.map((r) => (
            <li key={r.tournamentId} className={styles.result}>
              <div className={styles.resultHead}>
                <strong>{r.tournamentName}</strong>
                <Chip tone={resultTone(r.status)}>
                  <span aria-hidden="true">{ICONS[r.status] ?? "•"} </span>
                  {tc(`status.${r.status}`)}
                </Chip>
              </div>
              <CheckReasons reasons={r.reasons} rules={r.rules} />
            </li>
          ))}
        </ul>
      )}
      <ButtonLink href={`/swims/${swim.id}`} variant="secondary" block>
        {t("open")}
      </ButtonLink>
    </Card>
  );
}
