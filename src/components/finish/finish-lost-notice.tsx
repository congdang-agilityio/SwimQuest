import { getTranslations } from "next-intl/server";
import { getRoute } from "@/lib/routes";
import { getCurrentMembership } from "@/server/home/my-tournaments";
import { hasSeen } from "@/server/moments/seen";
import { FinishLostClose } from "./finish-lost-close";
import styles from "./finish.module.css";

/**
 * Told once per member and withdrawal: the team is no longer at the finish. Shown on Voyage and
 * My Team while `finishLostAt` is set (a new finish clears it); closing marks the SeenMoment key
 * `finish-lost:<team>:<finishLostAt>` seen, so a later withdrawal shows it again.
 */
export async function FinishLostNotice({ userId }: { userId: string }) {
  const current = await getCurrentMembership(userId);
  const lostAt = current?.team.finishLostAt;
  if (!current || !lostAt || current.team.finishedAt) return null;
  const momentKey = `finish-lost:${current.team.id}:${lostAt.getTime()}`;
  if (await hasSeen(userId, momentKey)) return null;

  const [t, tAll] = await Promise.all([getTranslations("team.finishLost"), getTranslations()]);
  const finishKey = getRoute(current.tournament.routeId)?.destinations.find(
    (d) => d.isFinish,
  )?.nameKey;
  const place = finishKey ? tAll(finishKey) : "";
  const reason = current.team.finishLostReason === "PLAYER_MOVED" ? "playerMoved" : "swimRevoked";

  return (
    <section className={styles.lost} role="status" data-testid="finish-lost-notice">
      <div className={styles.lostText}>
        <strong>{t("title", { place })}</strong>
        <span>{t(reason)}</span>
      </div>
      <FinishLostClose momentKey={momentKey} label={t("close")} />
    </section>
  );
}
