import { useTranslations } from "next-intl";
import { ArtImage } from "@/components/art/art-image";
import styles from "@/components/teams/my-team.module.css";
import { ButtonLink, Card } from "@/components/ui";
import { landmarkArt } from "@/lib/art/route01-art";
import { formatVnDateTime } from "@/lib/time/vn";

/** "Assigned automatically" with the assignment time (Vietnam time); reused by the Voyage page. */
export function StartOriginLabel({ setAtIso }: { setAtIso: string }) {
  const t = useTranslations();
  return (
    <span>{t("starts.origin.automaticAt", { setAt: formatVnDateTime(new Date(setAtIso)) })}</span>
  );
}

type Props = {
  /** Message key of the team's start name (`routes` namespace), or null when none is chosen. */
  startNameKey: string | null;
  /** Destination slug of the team's start, for its landmark art; null when none is chosen. */
  startSlug?: string | null;
  isCaptain: boolean;
  /** ISO instant of the start lock (start-choice deadline). */
  lockAtIso: string;
  locked: boolean;
  /** ISO instant the start was assigned automatically; null/omitted when a person chose it. */
  autoAssignedAtIso?: string | null;
};

/** The team's start on My Team; the captain gets a way in until the lock (FR-38). */
export function TeamStartCard({
  startNameKey,
  startSlug,
  isCaptain,
  lockAtIso,
  locked,
  autoAssignedAtIso,
}: Props) {
  const t = useTranslations();
  const canChoose = isCaptain && !locked;
  const art = startSlug ? landmarkArt(startSlug) : undefined;
  return (
    <Card as="section" aria-labelledby="team-start-title" className={styles.start}>
      <div className={styles.startHead}>
        <ArtImage
          art={art}
          alt=""
          className={styles.startArt}
          fallback={<span className={styles.startArt} aria-hidden="true" />}
        />
        <div>
          <h2 id="team-start-title" className={styles.startTitle}>
            {t("starts.card.title")}
          </h2>
          <p className={styles.startName}>
            {startNameKey ? t(startNameKey) : t("starts.card.notChosen")}
          </p>
        </div>
      </div>
      {startNameKey && autoAssignedAtIso && (
        <p className={styles.note}>
          <StartOriginLabel setAtIso={autoAssignedAtIso} />
        </p>
      )}
      {locked && (
        <p className={styles.note}>
          {t("starts.card.lockedSince", { lockedAt: formatVnDateTime(new Date(lockAtIso)) })}
        </p>
      )}
      {canChoose && (
        <>
          <p className={styles.note}>
            {t("starts.card.deadline", { deadline: formatVnDateTime(new Date(lockAtIso)) })}
          </p>
          {!startNameKey && <p className={styles.note}>{t("starts.card.auto")}</p>}
          <ButtonLink href="/team/start" variant="secondary" block>
            {startNameKey ? t("starts.card.change") : t("starts.card.choose")}
          </ButtonLink>
        </>
      )}
    </Card>
  );
}
