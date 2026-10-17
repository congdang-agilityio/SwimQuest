import { useTranslations } from "next-intl";
import { DeadlineRules } from "@/components/tournaments/rules/deadline-rules";
import { ExtraRules } from "@/components/tournaments/rules/extra-rules";
import { PointRules } from "@/components/tournaments/rules/point-rules";
import { RealisticLimitsRules } from "@/components/tournaments/rules/realistic-limits-rules";
import { SwimRules } from "@/components/tournaments/rules/swim-rules";
import type { TournamentDetails } from "@/server/tournaments/details";
import styles from "./details.module.css";

type Props = Pick<TournamentDetails, "rulesText" | "settings" | "seasonStartAt" | "routeDistanceM">;

/** The "Rules" section: the organizer's text as typed, then the settings in force in plain words. */
export function RulesSection({ rulesText, settings, seasonStartAt, routeDistanceM }: Props) {
  const t = useTranslations("details");
  return (
    <section aria-labelledby="details-rules" className={styles.head}>
      <h3 id="details-rules" className={styles.teamsTitle}>
        {t("rules")}
      </h3>
      {rulesText && <p className={styles.rulesText}>{rulesText}</p>}
      <div className={styles.rulesGroup}>
        <h4 className={styles.rulesTitle}>{t("rulesSwims")}</h4>
        <SwimRules rules={settings} />
      </div>
      <div className={styles.rulesGroup}>
        <h4 className={styles.rulesTitle}>{t("rulesDeadlines")}</h4>
        <DeadlineRules rules={{ ...settings, seasonStartAt }} />
      </div>
      <div className={styles.rulesGroup}>
        <h4 className={styles.rulesTitle}>{t("rulesPoints")}</h4>
        <PointRules values={settings} routeDistanceM={routeDistanceM} />
      </div>
      <div className={styles.rulesGroup}>
        <h4 className={styles.rulesTitle}>{t("rulesLimits")}</h4>
        <RealisticLimitsRules values={settings} />
      </div>
      <div className={styles.rulesGroup}>
        <h4 className={styles.rulesTitle}>{t("rulesExtra")}</h4>
        <ExtraRules values={settings} />
      </div>
    </section>
  );
}
