import { useTranslations } from "next-intl";
import styles from "./point-rules.module.css";

/** The ten point values as stored (percent: 110 = x1.10; distances in metres). */
export type PointValues = {
  pointsPerKm: number;
  firstSwimBonusPoints: number;
  longSwimTier1M: number;
  longSwimTier1Points: number;
  longSwimTier2M: number;
  longSwimTier2Points: number;
  multiplierTwoDaysPct: number;
  multiplierThreeDaysPct: number;
  streakStepPct: number;
  multiplierMaxPct: number;
};

/** 110 -> "1.10". */
const times = (pct: number) => (pct / 100).toFixed(2);

/** Route length in points: route km x points per km, whole points. */
export const routePoints = (routeDistanceM: number, pointsPerKm: number) =>
  Math.floor((routeDistanceM * pointsPerKm) / 1000);

/** The point values in plain words, the resulting route length, and why km and ship differ. */
export function PointRules({
  values: v,
  routeDistanceM,
}: {
  values: PointValues;
  routeDistanceM: number;
}) {
  const t = useTranslations("settings.points.rules");
  return (
    <div className={styles.rules}>
      <ul className={styles.list}>
        <li>{t("perKm", { points: v.pointsPerKm })}</li>
        <li>{t("firstSwim", { points: v.firstSwimBonusPoints })}</li>
        <li>{t("longSwim", { points: v.longSwimTier1Points, m: v.longSwimTier1M })}</li>
        <li>{t("longSwim", { points: v.longSwimTier2Points, m: v.longSwimTier2M })}</li>
        <li>
          {t("multipliers", {
            two: times(v.multiplierTwoDaysPct),
            three: times(v.multiplierThreeDaysPct),
          })}
        </li>
        <li>{t("streak", { step: v.streakStepPct, max: times(v.multiplierMaxPct) })}</li>
      </ul>
      <p className={styles.route}>
        {t("routeLength", {
          km: routeDistanceM / 1000,
          perKm: v.pointsPerKm,
          points: routePoints(routeDistanceM, v.pointsPerKm),
        })}
      </p>
      <p className={styles.note}>{t("shipNote")}</p>
      <p className={styles.note}>{t("xpNote")}</p>
    </div>
  );
}
