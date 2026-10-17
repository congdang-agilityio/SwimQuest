import { cookies, headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { JoinGuidance } from "@/components/empty-state/join-guidance";
import { FinishLostNotice } from "@/components/finish/finish-lost-notice";
import { TeamFinish } from "@/components/finish/team-finish";
import { TeamEmblem } from "@/components/teams/team-emblem";
import { ButtonLink, ProgressBar, ScreenHeader, SectionHeader } from "@/components/ui";
import { RouteMap } from "@/components/voyage/route-map";
import styles from "@/components/voyage/voyage.module.css";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { formatProgressPct } from "@/lib/scoring/progress";
import { requireUser } from "@/server/auth/current-user";
import { SELECTED_TOURNAMENT_COOKIE } from "@/server/home/selected-tournament";
import { getVoyage } from "@/server/voyage/get-voyage";

export const dynamic = "force-dynamic";

export default async function VoyagePage() {
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/voyage");
  const [t, tv, tl, voyage] = await Promise.all([
    getTranslations("tabs.voyage"),
    getTranslations("voyage"),
    getTranslations("leaderboard"),
    getVoyage(user.id, (await cookies()).get(SELECTED_TOURNAMENT_COOKIE)?.value),
  ]);
  if (!voyage) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <JoinGuidance />
      </main>
    );
  }
  const pct = voyage.progress.progressBp / 100;
  return (
    <main className={styles.panel}>
      {/* Phone: centred screen title. Desktop: the uppercase map band below carries the title. */}
      <div className={styles.screenHeader}>
        <ScreenHeader title={tv("screenTitle")} />
      </div>
      <div className={styles.headRow}>
        <div className={styles.mapTitle}>
          <SectionHeader>{tv("mapTitle")}</SectionHeader>
        </div>
        <div className={styles.teamCard}>
          <div className={styles.teamTop}>
            <span className={styles.emblemRing}>
              <TeamEmblem
                emblemKey={voyage.team.emblemKey}
                size={40}
                alt={tv("emblem", { team: voyage.team.name })}
              />
            </span>
            <div className={styles.teamText}>
              <span className={styles.teamKicker}>
                {t("tournament", { name: voyage.tournament.name })}
              </span>
              <strong className={styles.teamName}>{voyage.team.name}</strong>
            </div>
            <ButtonLink
              href={`/tournaments/${voyage.tournament.id}/leaderboard`}
              variant="secondary"
              size="sm"
            >
              {tl("link")}
            </ButtonLink>
          </div>
          <div className={styles.teamProgress}>
            <span className={styles.teamPct}>{formatProgressPct(voyage.progress.progressBp)}</span>
            <ProgressBar value={pct} label={tv("teamProgress")} />
          </div>
        </div>
      </div>
      {/* "Cập bến Lý Sơn" celebration, only once the team has finished: above the map. */}
      <div className={styles.finishSlot}>
        <FinishLostNotice userId={user.id} />
        <TeamFinish userId={user.id} />
      </div>
      <RouteMap
        routeId={voyage.tournament.routeId}
        teamName={voyage.team.name}
        destinations={voyage.destinations}
        path={voyage.path}
        start={
          voyage.start
            ? {
                slug: voyage.start.slug,
                automaticAtIso:
                  voyage.start.setBy === "AUTOMATIC" && voyage.start.setAt
                    ? voyage.start.setAt.toISOString()
                    : null,
              }
            : null
        }
        progress={voyage.progress}
        ship={voyage.ship}
      />
    </main>
  );
}
