"use client";

import { useRouter } from "next/navigation";
import { TeamForm, type TeamFormValues } from "./team-form";

/** The captain's "Edit team" form: saves through the details route, then back to My Team. */
export function CaptainTeamEdit({ teamId, initial }: { teamId: string; initial: TeamFormValues }) {
  const router = useRouter();
  const back = () => {
    router.push("/team");
    router.refresh();
  };
  return (
    <TeamForm
      mode="captain"
      action={{ method: "PATCH", url: `/api/teams/${teamId}/details` }}
      initial={initial}
      onSaved={back}
      onCancel={() => router.push("/team")}
    />
  );
}
