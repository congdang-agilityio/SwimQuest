import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { JoinGuidance } from "@/components/empty-state/join-guidance";
import { AccessDenied } from "@/components/states/access-denied";
import styles from "@/components/starts/start-picker.module.css";
import { CaptainTeamEdit } from "@/components/teams/captain-team-edit";
import { ScreenHeader } from "@/components/ui";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";
import { getCurrentMembership } from "@/server/home/my-tournaments";

export default async function EditTeamPage() {
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/team/edit");
  const membership = await getCurrentMembership(user.id);
  if (!membership) return <JoinGuidance />;
  const { team } = membership;
  if (team.captainUserId !== user.id) return <AccessDenied />;
  const t = await getTranslations("team.edit");
  return (
    <main className={styles.screen}>
      <div className={styles.headerBand}>
        <ScreenHeader
          id="edit-team-title"
          title={t("title")}
          backHref="/team"
          backLabel={(await getTranslations("common"))("back")}
        />
      </div>
      <CaptainTeamEdit
        teamId={team.id}
        initial={{
          name: team.name,
          emblemKey: team.emblemKey,
          description: team.description ?? "",
          memberLimit: team.memberLimit,
        }}
      />
    </main>
  );
}
