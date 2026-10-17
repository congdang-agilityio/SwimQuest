import { useTranslations } from "next-intl";
import { TeamEmblem } from "@/components/teams/team-emblem";
import { ButtonLink, Chip, ProgressBar, type ChipTone } from "@/components/ui";
import { formatProgressPct } from "@/lib/scoring/progress";
import type { TournamentStatus } from "@/lib/tournaments/lifecycle";
import { vnDayKey } from "@/lib/time/vn";
import type { MyTournament } from "@/server/home/my-tournaments";
import styles from "./tournament-card.module.css";

const STATUS_TONE: Record<TournamentStatus, ChipTone> = {
  DRAFT: "neutral",
  PUBLISHED: "info",
  ACTIVE: "success",
  COMPLETED: "gold",
  ARCHIVED: "neutral",
};

/** dd/mm/yyyy of the Vietnam calendar day. */
function vnDate(instant: Date): string {
  const [y, m, d] = vnDayKey(instant).split("-");
  return `${d}/${m}/${y}`;
}

/** One of my tournaments: my team, season, status, progress and the "Add swim" entry. */
export function TournamentCard({ tournament: x }: { tournament: MyTournament }) {
  const t = useTranslations("home.card");
  return (
    <li>
      <article className={styles.card} aria-labelledby={`tournament-${x.id}`}>
        <div className={styles.row}>
          <span className={styles.thumb}>
            {/* Cut from the mockup's "Giải đấu đang tham gia" row. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- static art, already sized */}
            <img
              className={styles.thumbArt}
              src="/art/mockup/screen-home/tournament-thumb.png"
              alt=""
              width={62}
              height={62}
            />
            {x.team && (
              <span className={styles.emblem}>
                <TeamEmblem
                  emblemKey={x.team.emblemKey}
                  size={28}
                  alt={t("emblemAlt", { name: x.team.name })}
                />
              </span>
            )}
          </span>
          <div className={styles.info}>
            <h3 id={`tournament-${x.id}`} className={styles.name}>
              {x.name}
            </h3>
            <p className={styles.dates}>
              {vnDate(x.seasonStartAt)} – {vnDate(x.seasonEndAt)}
            </p>
            <p className={styles.meta}>
              <Chip tone={STATUS_TONE[x.effectiveStatus]}>{t(`status.${x.effectiveStatus}`)}</Chip>
              <span>{x.team ? t("team", { name: x.team.name }) : t("noTeam")}</span>
            </p>
          </div>
        </div>
        {x.team &&
          (x.progressBp === null ? (
            <p className={styles.muted}>{t("progressNotStarted")}</p>
          ) : (
            <ProgressBar
              value={x.progressBp / 100}
              label={t("progressLabel")}
              caption={t("progress", { pct: formatProgressPct(x.progressBp) })}
            />
          ))}
        <ButtonLink href="/connect" variant="secondary" size="sm" block>
          {t("addSwim")}
        </ButtonLink>
      </article>
    </li>
  );
}
