import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { JoinGuidance } from "@/components/empty-state/join-guidance";
import { TeamStartCard } from "@/components/starts/team-start-card";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { isStartLocked, startLockAt } from "@/lib/tournaments/lifecycle";
import { requireUser } from "@/server/auth/current-user";
import { getCurrentMembership } from "@/server/home/my-tournaments";

export default async function TeamPage() {
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/team");
  const [t, membership] = await Promise.all([
    getTranslations("tabs.team"),
    getCurrentMembership(user.id),
  ]);
  return (
    <main>
      <h1>{t("title")}</h1>
      {membership ? (
        <>
          <p>{membership.team.name}</p>
          <TeamStartCard
            startSlug={membership.team.startDestination}
            isCaptain={membership.team.captainUserId === user.id}
            lockAtIso={startLockAt(membership.tournament).toISOString()}
            locked={isStartLocked(membership.tournament, new Date())}
          />
        </>
      ) : (
        <JoinGuidance />
      )}
    </main>
  );
}
