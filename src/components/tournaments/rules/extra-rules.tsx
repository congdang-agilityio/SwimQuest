import { useTranslations } from "next-intl";
import styles from "./point-rules.module.css";
import { formatPace } from "@/lib/validation/settings/extra-rules";

/** The two optional extra swim rules as stored; null = off. */
export type ExtraRulesValues = {
  minSwimDistanceM: number | null;
  extraSlowestPaceSecPer100m: number | null;
};

/** The extra swim rules in plain words, and what a swim that misses one means. */
export function ExtraRules({ values: v }: { values: ExtraRulesValues }) {
  const t = useTranslations("settings.extraRules.rules");
  const none = v.minSwimDistanceM === null && v.extraSlowestPaceSecPer100m === null;
  return (
    <div className={styles.rules}>
      {none ? (
        <p className={styles.route}>{t("none")}</p>
      ) : (
        <ul className={styles.list}>
          {v.minSwimDistanceM !== null && <li>{t("minDistance", { m: v.minSwimDistanceM })}</li>}
          {v.extraSlowestPaceSecPer100m !== null && (
            <li>{t("pace", { pace: formatPace(v.extraSlowestPaceSecPer100m) })}</li>
          )}
        </ul>
      )}
      <p className={styles.note}>{t("consequence")}</p>
    </div>
  );
}
