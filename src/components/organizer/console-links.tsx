import { useTranslations } from "next-intl";
import styles from "./console.module.css";
import { ButtonLink, SectionHeader } from "@/components/ui";

type Props = {
  tournamentId: string;
  /** Review queue and helpers exist once the tournament is published. */
  published: boolean;
  /** The invite link panel is on this page. */
  hasInvite: boolean;
  /** Details can still be edited (not archived). */
  canEdit?: boolean;
};

/** Organizer links of the console (S-65 AC 5): review queue, settings, invite link, helpers. */
export function ConsoleLinks({ tournamentId, published, hasInvite, canEdit = false }: Props) {
  const t = useTranslations("organizer");
  const base = `/tournaments/${tournamentId}/manage`;
  return (
    <nav aria-labelledby="console-links" className={styles.section}>
      <SectionHeader id="console-links">{t("console.links.title")}</SectionHeader>
      <div className={`${styles.sectionBody} ${styles.actions}`}>
        {published && (
          <ButtonLink href={`${base}/review`} block>
            {t("manage.reviewLink")}
          </ButtonLink>
        )}
        {canEdit && (
          <ButtonLink href={`${base}/edit`} variant="secondary" block>
            {t("manage.editLink")}
          </ButtonLink>
        )}
        <ButtonLink href={`${base}/settings`} variant="secondary" block>
          {t("manage.settingsLink")}
        </ButtonLink>
        {hasInvite && (
          <ButtonLink href="#invite-title" variant="secondary" block>
            {t("console.links.invite")}
          </ButtonLink>
        )}
        {published && (
          <ButtonLink href={`${base}/helpers`} variant="secondary" block>
            {t("manage.helpersLink")}
          </ButtonLink>
        )}
      </div>
    </nav>
  );
}
