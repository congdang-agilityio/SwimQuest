import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { MockupPicture } from "@/components/art/mockup-picture";
import { Card } from "@/components/ui";
import styles from "./safety.module.css";

/** Short safety note for the upload screen, linking to the full "Swim safely" page. */
export async function SafetyReminder() {
  const t = await getTranslations("safety");
  return (
    <Card as="section" className={styles.reminder} aria-label={t("title")}>
      <span className={styles.reminderArt}>
        <MockupPicture artKey="items/rescue-buoy" alt="" className={styles.reminderIcon} />
      </span>
      <p className={styles.reminderText}>
        {t("reminder.text")}{" "}
        <Link href="/safety" className={styles.link}>
          {t("reminder.link")}
        </Link>
      </p>
    </Card>
  );
}
