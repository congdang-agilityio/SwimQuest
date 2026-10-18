import { getFormatter, getTranslations } from "next-intl/server";
import { MockupPicture } from "@/components/art/mockup-picture";
import { TeamEmblem } from "@/components/teams/team-emblem";
import { Avatar, ButtonLink } from "@/components/ui";
import { WELCOME_PATH } from "@/lib/auth/public-paths";
import { defaultAvatarSrc, imageSrc } from "@/lib/profile-avatar";
import type { PublicFinish } from "@/server/finish/share";
import { FinishCrest } from "./finish-crest";
import styles from "./finish-card.module.css";
import scene from "./finish.module.css";

/**
 * The public finish (S-82, mockup panel "Cập bến Lý Sơn"): Lý Sơn scene, the HOÀN THÀNH emblem
 * and the team's facts. Shows only `getPublicFinish` data; a lost finish shows a notice instead.
 */
export async function FinishCard({ finish }: { finish: PublicFinish }) {
  const [t, tAll, format] = await Promise.all([
    getTranslations("share"),
    getTranslations(),
    getFormatter(),
  ]);
  const name = (key: string | null) => (key ? tAll(key) : "");
  const place = name(finish.route.finishKey);
  const team = finish.team.name;
  const date = (d: Date) => format.dateTime(d, { day: "numeric", month: "long", year: "numeric" });

  const invite = (
    <div className={styles.invite}>
      <p>{t("invite")}</p>
      <ButtonLink href={WELCOME_PATH} variant="primary" block>
        {t("cta")}
      </ButtonLink>
    </div>
  );

  if (!finish.finished || !finish.finishedAt) {
    return (
      <section className={styles.card} aria-labelledby="finish-title" data-testid="finish-lost">
        <h1 id="finish-title" className={scene.title}>
          {t("lostTitle", { place })}
        </h1>
        <div className={styles.lostBody}>
          <TeamEmblem emblemKey={finish.team.emblemKey} size={72} alt={t("emblemAlt", { team })} />
          <p>{t("lostBody", { team, place })}</p>
          {finish.finishLostAt && (
            <p className={styles.muted}>{t("lostDate", { date: date(finish.finishLostAt) })}</p>
          )}
        </div>
        {invite}
      </section>
    );
  }

  const start = name(finish.route.startKey);
  return (
    <section className={styles.card} aria-labelledby="finish-title" data-testid="finish-card">
      <h1 id="finish-title" className={scene.title}>
        {t("title", { place })}
      </h1>
      <div className={scene.hero}>
        <div className={scene.frame}>
          <MockupPicture artKey="scenes/sea-ly-son-4x3" alt="" className={scene.scene} eager />
        </div>
        <p className={scene.message}>
          <span className={scene.gold}>{t("congrats")}</span>
          <span>{t("done", { team })}</span>
          <span className={scene.gold}>{t("voyage", { place })}</span>
        </p>
      </div>
      <FinishCrest play alt={t("badgeAlt", { place })} label={t("ribbon")} />

      <div className={styles.facts}>
        <div className={styles.team}>
          <TeamEmblem emblemKey={finish.team.emblemKey} size={56} alt={t("emblemAlt", { team })} />
          <div>
            <p className={styles.teamName} data-testid="finish-team">
              {team}
            </p>
            <p className={styles.muted}>{t("tournament", { tournament: finish.tournamentName })}</p>
          </div>
        </div>
        <dl className={styles.list}>
          <div>
            <dt>{t("route")}</dt>
            <dd data-testid="finish-route">
              {name(finish.route.nameKey)}
              {start && place && (
                <span className={styles.leg}>{t("routeLeg", { start, finish: place })}</span>
              )}
            </dd>
          </div>
          <div>
            <dt>{t("date")}</dt>
            <dd data-testid="finish-date">
              <time dateTime={finish.finishedAt.toISOString()}>{date(finish.finishedAt)}</time>
            </dd>
          </div>
          <div>
            <dt>{t("total")}</dt>
            <dd data-testid="finish-total">
              <strong className={styles.total}>
                {t("km", {
                  km: format.number(finish.totalM / 1000, { maximumFractionDigits: 1 }),
                })}
              </strong>
              <span className={styles.leg}>
                {t("points", { points: format.number(finish.points) })}
              </span>
            </dd>
          </div>
        </dl>
        {finish.members.length > 0 && (
          <div className={styles.crew}>
            <h2 className={styles.crewTitle}>{t("members")}</h2>
            <ul className={styles.members}>
              {finish.members.map((m, i) => {
                const label = m.displayName ?? t("anonymous");
                const src = m.avatar
                  ? (imageSrc(m.avatar.imageId) ?? defaultAvatarSrc(m.avatar.defaultKey))
                  : null;
                return (
                  <li key={i} className={styles.member}>
                    <Avatar name={label} src={src} size={40} decorative />
                    <span>{label}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
      {invite}
    </section>
  );
}
