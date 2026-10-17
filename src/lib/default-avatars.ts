/** Keys of the built-in default avatars a player can pick instead of uploading (art: S-74). */
export const DEFAULT_AVATAR_KEYS = [
  "dolphin",
  "turtle",
  "shell",
  "anchor",
  "wave",
  "star",
  "fish",
  "ship",
] as const;

export type DefaultAvatarKey = (typeof DEFAULT_AVATAR_KEYS)[number];
