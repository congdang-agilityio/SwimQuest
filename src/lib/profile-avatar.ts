import { type DefaultAvatarKey } from "@/lib/default-avatars";
import { mockupMemberAvatar } from "@/lib/art/mockup-avatars";

/**
 * Art for the built-in default avatars, cut by the art groups (G2 badges/ships, G3 marine/items).
 * The keys are the animals and objects of S-74, so the people portraits (`characters/portrait-*`)
 * do not fit; swap these paths if the key list changes.
 */
export const DEFAULT_AVATAR_ART: Record<DefaultAvatarKey, string> = {
  dolphin: "/art/mockup/marine/dolphin.png",
  turtle: "/art/mockup/marine/sea-turtle.png",
  shell: "/art/mockup/items/seashell.png",
  anchor: "/art/mockup/badges/badge-coin-anchor.png",
  wave: "/art/mockup/badges/badge-shield-wave.png",
  star: "/art/mockup/items/star.png",
  fish: "/art/mockup/marine/clownfish.png",
  ship: "/art/mockup/ships/ship-tier-2.png",
};

export function defaultAvatarSrc(key: string | null | undefined): string | null {
  return key && key in DEFAULT_AVATAR_ART ? DEFAULT_AVATAR_ART[key as DefaultAvatarKey] : null;
}

export function imageSrc(id: string | null | undefined): string | null {
  return id ? `/api/images/${encodeURIComponent(id)}` : null;
}

/** The picture to show for a player: uploaded photo, chosen default, else the mockup placeholder. */
export function profileAvatarSrc(player: {
  id: string;
  avatarImageId?: string | null;
  avatarDefaultKey?: string | null;
}): string {
  return (
    imageSrc(player.avatarImageId) ??
    defaultAvatarSrc(player.avatarDefaultKey) ??
    mockupMemberAvatar(player.id)
  );
}
