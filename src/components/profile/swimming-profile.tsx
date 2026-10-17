import { useFormatter, useTranslations } from "next-intl";
import { Card, Chip, SectionHeader } from "@/components/ui";
import { formatKm } from "@/lib/decimal-km";
import type { MyProfile } from "@/server/profile/my-profile";
import styles from "./swimming-profile.module.css";

/** The player's own goals and disciplines, labelled as unverified and apart from the stats. */
export function SwimmingProfile({
  profile,
  locale,
}: {
  profile: Pick<MyProfile, "goalsText" | "goalDistanceM" | "disciplines">;
  locale: string;
}) {
  const t = useTranslations("profile.view");
  const td = useTranslations("profile.disciplines");
  const format = useFormatter();
  const { goalsText, goalDistanceM, disciplines } = profile;
  const empty = !goalsText && !goalDistanceM && disciplines.length === 0;
  return (
    <Card as="section" className={styles.block} aria-labelledby="my-goals">
      <SectionHeader id="my-goals">{t("goalsTitle")}</SectionHeader>
      {empty && <p className={styles.muted}>{t("goalsEmpty")}</p>}
      {goalsText && <p className={styles.text}>{goalsText}</p>}
      {(goalDistanceM || disciplines.length > 0) && (
        <div className={styles.chips}>
          {goalDistanceM ? (
            <Chip tone="info">
              {goalDistanceM < 1000
                ? t("goalDistanceM", { m: format.number(goalDistanceM) })
                : t("goalDistance", { km: formatKm(goalDistanceM, locale) })}
            </Chip>
          ) : null}
          {disciplines.map((d) => (
            <Chip key={d}>{td.has(d) ? td(d) : d}</Chip>
          ))}
        </div>
      )}
    </Card>
  );
}
