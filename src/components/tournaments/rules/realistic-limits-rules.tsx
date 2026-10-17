import { useTranslations } from "next-intl";
import styles from "./point-rules.module.css";
import { formatPace } from "@/lib/validation/settings/extra-rules";

/** The realistic swim limits as stored; null = not a valid value yet. */
export type RealisticLimitsValues = {
  fastestPaceSecPer100m: number | null;
  slowestPaceSecPer100m: number | null;
  longestRealisticSwimM: number | null;
};

/** The realistic swim limits in plain words: what gets a swim flagged for review. */
export function RealisticLimitsRules({ values: v }: { values: RealisticLimitsValues }) {
  const t = useTranslations("settings.realisticLimits.rules");
  const dash = t("unset");
  const pace = (sec: number | null) => (sec === null ? dash : formatPace(sec));
  return (
    <div className={styles.rules}>
      <ul className={styles.list}>
        <li>{t("fastest", { pace: pace(v.fastestPaceSecPer100m) })}</li>
        <li>{t("slowest", { pace: pace(v.slowestPaceSecPer100m) })}</li>
        <li>
          {t("longest", {
            km: v.longestRealisticSwimM === null ? dash : String(v.longestRealisticSwimM / 1000),
          })}
        </li>
      </ul>
      <p className={styles.note}>{t("flagged")}</p>
      <p className={styles.note}>{t("difference")}</p>
    </div>
  );
}
