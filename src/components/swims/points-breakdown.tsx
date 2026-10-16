import { useTranslations } from "next-intl";
import type { SwimPointsBreakdown } from "@/server/swims/my-swims";

/** Distance points, each bonus (only when earned) and the total, one per line. */
export function PointsBreakdown({ points }: { points: SwimPointsBreakdown }) {
  const t = useTranslations("my-swims.detail");
  return (
    <ul>
      <li>{t("distancePoints", { points: points.distance })}</li>
      {points.firstSwimBonus !== 0 && (
        <li>{t("firstSwimBonus", { points: points.firstSwimBonus })}</li>
      )}
      {points.longSwimBonus !== 0 && (
        <li>{t("longSwimBonus", { points: points.longSwimBonus })}</li>
      )}
      <li>{t("points", { points: points.total })}</li>
    </ul>
  );
}
