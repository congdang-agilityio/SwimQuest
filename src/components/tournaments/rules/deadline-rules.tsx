import { useTranslations } from "next-intl";
import { formatVnDateTime } from "@/lib/time/vn";

export type DeadlineRulesValues = {
  submissionDays: number;
  lateUploadDays: number;
  /** null = the start choice closes at the season start. */
  startChoiceDeadlineAt: Date | null;
  seasonStartAt: Date;
};

/** The deadline settings in plain words (players' view; reused by the details page). */
export function DeadlineRules({ rules }: { rules: DeadlineRulesValues }) {
  const t = useTranslations("settings");
  return (
    <ul>
      <li>{t("rules.uploadDeadline", { n: rules.submissionDays, m: rules.lateUploadDays })}</li>
      <li>
        {rules.startChoiceDeadlineAt
          ? t("rules.startChoiceAt", { at: formatVnDateTime(rules.startChoiceDeadlineAt) })
          : t("rules.startChoiceAtSeasonStart", { at: formatVnDateTime(rules.seasonStartAt) })}
      </li>
    </ul>
  );
}
