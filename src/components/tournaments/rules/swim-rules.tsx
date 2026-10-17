import { useLocale, useTranslations } from "next-intl";
import { formatKm } from "@/lib/decimal-km";

export type SwimRulesValues = {
  longestSwimCountedM: number;
  dailyLimitM: number;
  swimTypeAllowed: "ANY" | "POOL_ONLY" | "OPEN_WATER_ONLY";
};

/** Whole metres as km text in the locale's decimal separator ("10", "2,5" in vi). */
export const kmText = (metres: number, locale: string) => formatKm(metres, locale);

/** The swim settings in plain words (players' view; reused by the details page). */
export function SwimRules({ rules }: { rules: SwimRulesValues }) {
  const t = useTranslations("settings");
  const locale = useLocale();
  return (
    <ul>
      <li>{t("rules.longestSwimCounted", { km: kmText(rules.longestSwimCountedM, locale) })}</li>
      <li>{t("rules.dailyLimit", { km: kmText(rules.dailyLimitM, locale) })}</li>
      <li>{t("rules.swimType", { type: t(`swim.types.${rules.swimTypeAllowed}`) })}</li>
    </ul>
  );
}
