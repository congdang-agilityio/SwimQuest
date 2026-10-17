import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { TeamPicker } from "@/components/join/team-picker";
import { ZaloNotice } from "@/components/zalo/zalo-notice";
import styles from "@/components/join/join.module.css";
import { TournamentSummary } from "@/components/tournaments/tournament-summary";
import { ButtonLink, Card, ScreenHeader } from "@/components/ui";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";
import { getPublicJoinView } from "@/server/join/public-join";

/** Join a public tournament without an invite link: summary plus team picker. Not found otherwise. */
export default async function PublicJoinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(
    (await headers()).get(NEXT_PATH_HEADER) ?? `/tournaments/${encodeURIComponent(id)}/join`,
  );
  const [t, tCommon, view] = await Promise.all([
    getTranslations("join"),
    getTranslations("common"),
    getPublicJoinView(user.id, id),
  ]);
  if (!view) notFound();

  const { tournament, myTeam, joiningOpen } = view;
  const freeTeams = view.teams.map((x) => ({
    id: x.id,
    name: x.name,
    emblemKey: x.emblemKey,
    freePlaces: Math.max(0, x.memberLimit - x.memberCount),
  }));
  const closed = !joiningOpen && !myTeam;
  return (
    <main className={styles.screen}>
      <div className={styles.headerBand}>
        <ScreenHeader title={t("title")} backHref="/" backLabel={tCommon("back")} />
      </div>
      <TournamentSummary
        name={tournament.name}
        description={tournament.description}
        seasonStartAt={tournament.seasonStartAt}
        seasonEndAt={tournament.seasonEndAt}
        routeId={tournament.routeId}
        routeDistanceM={tournament.routeDistanceM}
        teams={freeTeams}
        hideTeams={!closed}
      />
      <ButtonLink href={`/tournaments/${tournament.id}`} variant="secondary" block>
        {t("details")}
      </ButtonLink>
      <ZaloNotice tournamentId={tournament.id} />
      {closed ? (
        <Card role="status" className={styles.notice}>
          <p>
            <strong>{t("closedTitle")}.</strong> {t("closedBody")}
          </p>
        </Card>
      ) : (
        <TeamPicker
          submitUrl={`/api/tournaments/${encodeURIComponent(tournament.id)}/join`}
          teams={freeTeams}
          myTeam={myTeam}
        />
      )}
      {tournament.eligibilityNotes && (
        <Card as="section" className={styles.eligibility}>
          <h3>{t("eligibility")}</h3>
          <p>{tournament.eligibilityNotes}</p>
        </Card>
      )}
    </main>
  );
}
