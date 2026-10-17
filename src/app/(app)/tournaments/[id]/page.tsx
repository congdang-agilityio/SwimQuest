import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DetailsHeader } from "@/components/tournaments/details/details-header";
import { DetailsTeams } from "@/components/tournaments/details/details-teams";
import { TournamentExtras } from "@/components/tournaments/tournament-extras";
import { RulesSection } from "@/components/tournaments/details/rules-section";
import styles from "@/components/tournaments/details/details.module.css";
import { ButtonLink, Card, ScreenHeader, SectionHeader } from "@/components/ui";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";
import { findMyTeam } from "@/server/join/join-view";
import { getTournamentDetails } from "@/server/tournaments/details";

export const dynamic = "force-dynamic";

/** Tournament details; `?token=` is the invite token carried over from the join page. */
export default async function TournamentDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? `/tournaments/${id}`);
  const details = await getTournamentDetails(user.id, id, { token });
  if (!details) notFound();
  const [t, tCommon, myTeam] = await Promise.all([
    getTranslations("details"),
    getTranslations("common"),
    findMyTeam(user.id, details.id),
  ]);
  // The leaderboard is for members and the organizer, so only they get the link.
  const showLeaderboard = myTeam !== null || details.organizer.id === user.id;
  return (
    <main className={styles.screen}>
      <div className={styles.headerBand}>
        <ScreenHeader title={t("title")} backHref="/tournaments" backLabel={tCommon("back")} />
      </div>
      <section className={styles.panel} aria-labelledby="details-panel-title">
        <div className={styles.panelHeader}>
          <SectionHeader id="details-panel-title">{t("panelTitle")}</SectionHeader>
        </div>
        <Card as="article" aria-labelledby="details-name" className={styles.card}>
          <DetailsHeader
            name={details.name}
            bannerImageId={details.bannerImageId}
            logoImageId={details.logoImageId}
            description={details.description}
            organizerName={details.organizer.displayName}
            status={details.status}
            seasonStartAt={details.seasonStartAt}
            seasonEndAt={details.seasonEndAt}
            routeId={details.routeId}
            routeDistanceM={details.routeDistanceM}
            reportTournamentId={details.organizer.id === user.id ? undefined : details.id}
          />
          <TournamentExtras
            rulesUrl={details.rulesUrl}
            contactChannel={details.contactChannel}
            eligibilityNotes={details.eligibilityNotes}
          />
          <DetailsTeams teams={details.teams} />
          <RulesSection
            rulesText={details.rulesText}
            settings={details.settings}
            seasonStartAt={details.seasonStartAt}
            routeDistanceM={details.routeDistanceM}
          />
          {(details.joinHref || showLeaderboard) && (
            <nav aria-label={t("actions")} className={styles.actions}>
              {details.joinHref && <ButtonLink href={details.joinHref}>{t("join")}</ButtonLink>}
              {showLeaderboard && (
                <ButtonLink
                  href={`/tournaments/${details.id}/leaderboard`}
                  variant={details.joinHref ? "secondary" : "primary"}
                >
                  {t("leaderboard")}
                </ButtonLink>
              )}
            </nav>
          )}
        </Card>
      </section>
    </main>
  );
}
