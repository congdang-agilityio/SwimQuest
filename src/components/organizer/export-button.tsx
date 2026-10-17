import { useTranslations } from "next-intl";
import { buttonClass, SectionHeader } from "@/components/ui";
import styles from "@/components/tournaments/manage.module.css";

/** Organizer-only download of the tournament's CSV (S-79): display names, km and points. */
export function ExportButton({ tournamentId }: { tournamentId: string }) {
  const t = useTranslations("organizer.console.export");
  return (
    <section aria-labelledby="export-title" className={styles.panel}>
      <SectionHeader id="export-title">{t("title")}</SectionHeader>
      <div className={styles.panelBody}>
        <p className={styles.hint}>{t("note")}</p>
        <a
          href={`/api/tournaments/${tournamentId}/export`}
          download
          className={buttonClass({ variant: "secondary" })}
        >
          {t("button")}
        </a>
      </div>
    </section>
  );
}
