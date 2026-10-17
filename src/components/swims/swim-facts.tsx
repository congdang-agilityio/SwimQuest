import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { ChipTone } from "@/components/ui";
import styles from "./swims.module.css";

/** Wave band cut from the mockup's "Ghi nhận hoạt động" screen (temporary screen asset until the G3 effects art lands). */
const WAVE_BAND = "/art/mockup/screen-swims/wave-band.png";

/** The mockup's result hero: big distance, the duration under it and the wave band. */
export function SwimHero({ distance, duration }: { distance: string; duration: string }) {
  const t = useTranslations("swims.summary");
  return (
    <div className={styles.hero}>
      <dl className={styles.heroStats}>
        <div>
          <dt className={styles.heroLabel}>{t("distance")}</dt>
          <dd className={styles.heroDistance}>{distance}</dd>
        </div>
        <div>
          <dt className={styles.srOnly}>{t("duration")}</dt>
          <dd className={styles.heroDuration}>{duration}</dd>
        </div>
      </dl>
      {/* eslint-disable-next-line @next/next/no-img-element -- small static decoration */}
      <img className={styles.wave} src={WAVE_BAND} alt="" width={244} height={70} />
    </div>
  );
}

/** The remaining facts as label / value rows. */
export function SwimFactRows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className={styles.rows}>
      {rows.map(([label, value]) => (
        <div key={label} className={styles.row}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Chip tone of a per-tournament result status; the chip always carries the words too. */
export function resultTone(status: string): ChipTone {
  if (status === "VERIFIED") return "success";
  if (status === "REJECTED" || status === "REVOKED" || status === "RULE_MISSED") return "danger";
  if (status === "FLAGGED" || status === "DUPLICATE" || status === "DISPUTED") return "warning";
  return "neutral";
}

/** Chip tone of the swim-level status from lib/format/swim's swimStatus. */
export function swimTone(status: string): ChipTone {
  if (status === "counted") return "success";
  if (status === "flagged" || status === "duplicate") return "warning";
  if (status === "notSwim") return "danger";
  return "info";
}
