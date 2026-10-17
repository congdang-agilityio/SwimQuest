import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { MockupPicture } from "@/components/art/mockup-picture";
import { COLLECTIBLE_ART } from "@/lib/art/collectibles";
import styles from "./energy-orb.module.css";

/**
 * The energy orb shown while a player's weekly multiplier is active (S-84 AC 4). A state, not a
 * collectible: it is never listed among collected items. Static when reduced motion is requested.
 */
export function EnergyOrb({ size = 28, className }: { size?: number; className?: string }) {
  const t = useTranslations("collectibles");
  return (
    <span
      role="img"
      aria-label={t("energyOrb")}
      title={t("energyOrb")}
      data-testid="energy-orb"
      className={[styles.orb, className].filter(Boolean).join(" ")}
      style={{ "--orb-size": `${size}px` } as CSSProperties}
    >
      <MockupPicture artKey={COLLECTIBLE_ART.energyOrb} alt="" className={styles.art} />
    </span>
  );
}
