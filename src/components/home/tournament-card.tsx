import Link from "next/link";
import { useTranslations } from "next-intl";
import styles from "@/components/nav/app-nav.module.css";
import { TeamEmblem } from "@/components/teams/team-emblem";
import { formatProgressPct } from "@/lib/scoring/progress";
import type { MyTournament } from "@/server/home/my-tournaments";

/** One of my tournaments: my team, status, progress and the "Add swim" entry. */
export function TournamentCard({ tournament: x }: { tournament: MyTournament }) {
  const t = useTranslations("home.card");
  return (
    <li>
      <article aria-labelledby={`tournament-${x.id}`}>
        <h2 id={`tournament-${x.id}`}>{x.name}</h2>
        {x.team ? (
          <p>
            <TeamEmblem
              emblemKey={x.team.emblemKey}
              size={24}
              alt={t("emblemAlt", { name: x.team.name })}
            />{" "}
            {t("team", { name: x.team.name })}
          </p>
        ) : (
          <p>{t("noTeam")}</p>
        )}
        <p>{t(`status.${x.effectiveStatus}`)}</p>
        <p>
          {x.progressBp === null
            ? t("progressNotStarted")
            : t("progress", { pct: formatProgressPct(x.progressBp) })}
        </p>
        <Link href="/connect" className={styles.tap}>
          {t("addSwim")}
        </Link>
      </article>
    </li>
  );
}
