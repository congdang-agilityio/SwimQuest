import { db } from "@/server/db";

export type AvatarFields = { avatarImageId: string | null; avatarDefaultKey: string | null };

/** The signed-in player's avatar choice (uploaded image id and/or built-in default key). */
export async function getAvatarFields(userId: string): Promise<AvatarFields> {
  const row = await db.user.findUnique({
    where: { id: userId },
    select: { avatarImageId: true, avatarDefaultKey: true },
  });
  return {
    avatarImageId: row?.avatarImageId ?? null,
    avatarDefaultKey: row?.avatarDefaultKey ?? null,
  };
}
