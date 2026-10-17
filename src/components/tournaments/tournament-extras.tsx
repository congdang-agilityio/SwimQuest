import { useTranslations } from "next-intl";
import styles from "./details/details.module.css";

type Props = {
  rulesUrl?: string | null;
  contactChannel?: string | null;
  eligibilityNotes?: string | null;
};

/** The http(s) address as a URL, or null; the page never links anything else. */
function safeHref(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * The organizer's rules link, contact channel and eligibility notes. Empty fields render
 * nothing. Every organizer text is a React text node, so it is plain text and never HTML.
 */
export function TournamentExtras({ rulesUrl, contactChannel, eligibilityNotes }: Props) {
  const t = useTranslations("details.extras");
  const href = rulesUrl ? safeHref(rulesUrl) : null;
  if (!href && !contactChannel && !eligibilityNotes) return null;
  return (
    <dl className={styles.extras}>
      {href && (
        <div className={styles.extra}>
          <dt>{t("rulesUrl")}</dt>
          <dd>
            <a href={href} target="_blank" rel="noopener noreferrer">
              {rulesUrl}
            </a>
          </dd>
        </div>
      )}
      {contactChannel && (
        <div className={styles.extra}>
          <dt>{t("contactChannel")}</dt>
          <dd>{contactChannel}</dd>
        </div>
      )}
      {eligibilityNotes && (
        <div className={styles.extra}>
          <dt>{t("eligibilityNotes")}</dt>
          <dd>
            {eligibilityNotes}
            <span className={styles.extraNote}>{t("notChecked")}</span>
          </dd>
        </div>
      )}
    </dl>
  );
}
