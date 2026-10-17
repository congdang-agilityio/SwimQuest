import { headers } from "next/headers";
import { InviteToTeam } from "@/components/teams/invite-to-team";
import { getSelectedMembershipFromCookie } from "@/server/home/selected-tournament";
import { pageOrigin } from "@/server/http/request";
import { getCaptainInviteLink } from "@/server/teams/captain-invite";

/** The captain's "Invite to team" card. Renders nothing for members or when the link is off. */
export async function CaptainInvite({ userId }: { userId: string }) {
  const membership = await getSelectedMembershipFromCookie(userId);
  const origin = pageOrigin(await headers());
  if (!membership || !origin) return null;
  const url = await getCaptainInviteLink(userId, membership.team.id, origin);
  return url ? <InviteToTeam url={url} teamName={membership.team.name} /> : null;
}
