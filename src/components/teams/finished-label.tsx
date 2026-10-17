import { SafeImg } from "@/components/art/safe-img";
import { useTranslations } from "next-intl";
import { Chip } from "@/components/ui";
import { mockupArt } from "@/lib/art/mockup-art";
import { utcToVnParts } from "@/lib/time/vn";
import styles from "./finished-label.module.css";

/** "dd/MM/yyyy HH:mm" in Vietnam time (the tournament clock), whatever the server time zone. */
function formatVnWhen(instant: Date): string {
  const { date, time } = utcToVnParts(instant);
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y} ${time}`;
}

/**
 * Marks a team that finished the route: a gold chip with the lighthouse shield (art group G2)
 * and the word "Finished", then the finish date and time in Vietnam time. Text plus icon, never
 * colour alone. Render it only for a team whose `finishedAt` is set.
 */
export function FinishedLabel({ finishedAt, onDark }: { finishedAt: Date; onDark?: boolean }) {
  const t = useTranslations("finish");
  const badge = mockupArt("badges/badge-shield-lighthouse")?.webp;
  return (
    <span className={styles.label} data-testid="finished-label">
      <Chip tone="gold" className={styles.chip}>
        {badge && <SafeImg src={badge} alt="" width={16} height={16} />}
        <span>{t("finished")}</span>
      </Chip>
      <time
        dateTime={finishedAt.toISOString()}
        className={onDark ? `${styles.when} ${styles.onDark}` : styles.when}
      >
        {formatVnWhen(finishedAt)}
      </time>
    </span>
  );
}
