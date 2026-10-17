/**
 * Art cut from the stakeholder mockup's "ĐỘI CỦA TÔI" panel
 * (requirement/assets/reference/swimquest_full_platform_ui_concept.png), 2x LANCZOS, transparent.
 * Temporary screen-local crops (public/art/mockup/screen-team/), to be swapped for the shared
 * group assets (#703/#704) once they are on main. Until players upload photos, each member gets one of the
 * mockup avatars, picked from their id.
 */
const MEMBER_AVATARS = [1, 2, 3, 4, 5].map((n) => `/art/mockup/screen-team/member-${n}.png`);

/** The blue swirl logo of the mockup team; used for the "wave" emblem on My Team. */
export const MOCKUP_TEAM_EMBLEM = "/art/mockup/screen-team/team-emblem-swirl.png";

export function mockupMemberAvatar(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return MEMBER_AVATARS[h % MEMBER_AVATARS.length];
}
