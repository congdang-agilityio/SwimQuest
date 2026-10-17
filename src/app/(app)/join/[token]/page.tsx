import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { MockupPicture } from "@/components/art/mockup-picture";
import { TeamPicker } from "@/components/join/team-picker";
import styles from "@/components/join/join.module.css";
import { TournamentSummary } from "@/components/tournaments/tournament-summary";
import { ButtonLink, Card, ScreenHeader } from "@/components/ui";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";
import { getJoinView } from "@/server/join/join-view";

/** What an invite link opens: tournament summary plus the team picker, or a closed/invalid state. */
export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ team?: string | string[] }>;
}) {
  const { token } = await params;
  const { team: teamParam } = await searchParams;
  const requestedTeam = typeof teamParam === "string" ? teamParam : null;
  const user = await requireUser(
    (await headers()).get(NEXT_PATH_HEADER) ?? `/join/${encodeURIComponent(token)}`,
  );
  const [t, tCommon, view] = await Promise.all([
    getTranslations("join"),
    getTranslations("common"),
    getJoinView(user.id, token),
  ]);

  if (!view) {
    return (
      <main className={styles.screen}>
        <div className={styles.headerBand}>
          <ScreenHeader title={t("invalidTitle")} backHref="/" backLabel={tCommon("back")} />
        </div>
        <Card className={styles.notice}>
          <MockupPicture artKey="items/message-bottle" alt="" className={styles.noticeArt} />
          <p>{t("invalidBody")}</p>
        </Card>
      </main>
    );
  }
  const { tournament, myTeam, joiningOpen } = view;
  const freeTeams = view.teams.map((x) => ({
    id: x.id,
    name: x.name,
    emblemKey: x.emblemKey,
    freePlaces: Math.max(0, x.memberLimit - x.memberCount),
  }));
  // Only a team of this tournament can be preselected; anything else is ignored.
  const preselectedId = freeTeams.find((x) => x.id === requestedTeam)?.id ?? null;
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
        // The picker below lists the same teams with their places; show them once.
        hideTeams={!closed}
      />
      <ButtonLink
        href={`/tournaments/${tournament.id}?token=${encodeURIComponent(token)}`}
        variant="secondary"
        block
      >
        {t("details")}
      </ButtonLink>
      {closed ? (
        <Card role="status" className={styles.notice}>
          <MockupPicture artKey="map/buoy" alt="" className={styles.noticeArt} />
          <p>
            <strong>{t("closedTitle")}.</strong> {t("closedBody")}
          </p>
        </Card>
      ) : (
        <TeamPicker token={token} teams={freeTeams} myTeam={myTeam} preselectedId={preselectedId} />
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
