import { getTranslations } from "next-intl/server";
import { MockupPicture } from "@/components/art/mockup-picture";
import { ButtonLink } from "@/components/ui";
import { getRoute } from "@/lib/routes";
import { getCurrentMembership } from "@/server/home/my-tournaments";
import { hasSeen } from "@/server/moments/seen";
import { FinishCrest } from "./finish-crest";
import styles from "./finish.module.css";

/**
 * "Cập bến Lý Sơn" (mockup panel 7): shown on My Team and Voyage once the player's team has
 * finished the route. Presentational only: it reads `team.finishedAt`, nothing is scored here.
 * The crest sparkles once per finish (SeenMoment key `finish:<team>:<finishedAt>`).
 */
export async function TeamFinish({
  userId,
  onlyUnseen = false,
}: {
  userId: string;
  /** Home: show the panel only until this finish has been seen (Voyage and My Team keep it). */
  onlyUnseen?: boolean;
}) {
  const current = await getCurrentMembership(userId);
  const finishedAt = current?.team.finishedAt;
  if (!current || !finishedAt) return null;
  const { team, tournament } = current;
  const [t, tAll, tl] = await Promise.all([
    getTranslations("team.finish"),
    getTranslations(),
    getTranslations("leaderboard"),
  ]);
  const finishKey = getRoute(tournament.routeId)?.destinations.find((d) => d.isFinish)?.nameKey;
  const place = finishKey ? tAll(finishKey) : "";
  const momentKey = `finish:${team.id}:${finishedAt.getTime()}`;
  const seen = await hasSeen(userId, momentKey);
  if (onlyUnseen && seen) return null;

  return (
    <section
      className={styles.finish}
      aria-labelledby="team-finish-title"
      data-testid="team-finish"
    >
      <h2 id="team-finish-title" className={styles.title}>
        {t("title", { place })}
      </h2>
      <div className={styles.hero}>
        <div className={styles.frame}>
          <MockupPicture artKey="scenes/sea-ly-son-4x3" alt="" className={styles.scene} eager />
        </div>
        <p className={styles.message}>
          <span className={styles.gold}>{t("congrats")}</span>
          <span>{t("done")}</span>
          <span className={styles.gold}>{t("voyage", { place })}</span>
        </p>
      </div>
      <FinishCrest momentKey={momentKey} play={!seen} alt={t("badgeAlt", { place })} />
      <div className={styles.action}>
        <ButtonLink href={`/tournaments/${tournament.id}/leaderboard`} variant="primary" block>
          {tl("link")}
        </ButtonLink>
      </div>
    </section>
  );
}
