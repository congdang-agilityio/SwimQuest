import { useTranslations } from "next-intl";

export type SwimRulesValues = {
  longestSwimCountedM: number;
  dailyLimitM: number;
  swimTypeAllowed: "ANY" | "POOL_ONLY" | "OPEN_WATER_ONLY";
};

/** Whole metres as plain km text ("10", "2.5"). */
export const kmText = (metres: number) => String(metres / 1000);

/** The swim settings in plain words (players' view; reused by the details page). */
export function SwimRules({ rules }: { rules: SwimRulesValues }) {
  const t = useTranslations("settings");
  return (
    <ul>
      <li>{t("rules.longestSwimCounted", { km: kmText(rules.longestSwimCountedM) })}</li>
      <li>{t("rules.dailyLimit", { km: kmText(rules.dailyLimitM) })}</li>
      <li>{t("rules.swimType", { type: t(`swim.types.${rules.swimTypeAllowed}`) })}</li>
    </ul>
  );
}
