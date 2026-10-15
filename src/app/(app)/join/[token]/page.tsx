import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { TeamPicker } from "@/components/join/team-picker";
import { TournamentSummary } from "@/components/tournaments/tournament-summary";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";
import { getJoinView } from "@/server/join/join-view";

/** What an invite link opens: tournament summary plus the team picker, or a closed/invalid state. */
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await requireUser(
    (await headers()).get(NEXT_PATH_HEADER) ?? `/join/${encodeURIComponent(token)}`,
  );
  const [t, view] = await Promise.all([getTranslations("join"), getJoinView(user.id, token)]);

  if (!view) {
    return (
      <main>
        <h1>{t("invalidTitle")}</h1>
        <p>{t("invalidBody")}</p>
      </main>
    );
  }
  const { tournament, teams, myTeam, joiningOpen } = view;
  const freeTeams = teams.map((x) => ({
    id: x.id,
    name: x.name,
    emblemKey: x.emblemKey,
    freePlaces: Math.max(0, x.memberLimit - x.memberCount),
  }));
  return (
    <main>
      <h1>{t("title")}</h1>
      {!joiningOpen && !myTeam ? (
        <>
          <h2>{t("closedTitle")}</h2>
          <p>{t("closedBody")}</p>
        </>
      ) : (
        <TeamPicker token={token} teams={freeTeams} myTeam={myTeam} />
      )}
      <TournamentSummary
        name={tournament.name}
        description={tournament.description}
        seasonStartAt={tournament.seasonStartAt}
        seasonEndAt={tournament.seasonEndAt}
        routeId={tournament.routeId}
        routeDistanceM={tournament.routeDistanceM}
        teams={freeTeams}
      />
      {tournament.eligibilityNotes && (
        <section>
          <h3>{t("eligibility")}</h3>
          <p>{tournament.eligibilityNotes}</p>
        </section>
      )}
    </main>
  );
}
