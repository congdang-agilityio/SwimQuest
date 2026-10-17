import { useTranslations } from "next-intl";
import { ArtImage } from "@/components/art/art-image";
import { ButtonLink, Card } from "@/components/ui";
import { landmarkArt } from "@/lib/art/route01-art";
import styles from "./join-guidance.module.css";

/** Shown to a user who is in no tournament: how to join, plus the "Create tournament" button. */
export function JoinGuidance() {
  const t = useTranslations("tabs.joinGuidance");
  return (
    <Card as="section" className={styles.card} aria-labelledby="join-guidance-title">
      <ArtImage art={landmarkArt("ly_son")} alt="" className={styles.art} fallback={null} />
      <h2 id="join-guidance-title" className={styles.title}>
        {t("title")}
      </h2>
      <p className={styles.body}>{t("body")}</p>
      <ButtonLink href="/tournaments/new" variant="primary" block>
        {t("create")}
      </ButtonLink>
    </Card>
  );
}
