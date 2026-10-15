import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { LogoutButton } from "@/components/auth/logout-button";
import { JoinGuidance } from "@/components/empty-state/join-guidance";
import { TournamentCard } from "@/components/home/tournament-card";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";
import { listMyTournaments } from "@/server/home/my-tournaments";

export default async function HomePage() {
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/");
  const [t, tournaments] = await Promise.all([
    getTranslations("home"),
    listMyTournaments(user.id, new Date()),
  ]);
  return (
    <main>
      <h1>SwimQuest</h1>
      {tournaments.length === 0 ? (
        <JoinGuidance />
      ) : (
        <section aria-labelledby="home-tournaments">
          <h2 id="home-tournaments">{t("title")}</h2>
          <ul>
            {tournaments.map((x) => (
              <TournamentCard key={x.id} tournament={x} />
            ))}
          </ul>
        </section>
      )}
      <LogoutButton />
    </main>
  );
}
