import { db } from "@/server/db";
import { parseProfileUpdate, type ProfileErrors } from "@/lib/validation/profile";

const MY_PROFILE_SELECT = {
  id: true,
  displayName: true,
  avatarImageId: true,
  avatarDefaultKey: true,
  coverImageId: true,
  bio: true,
  regionCode: true,
} as const;

export type MyProfile = {
  id: string;
  displayName: string;
  avatarImageId: string | null;
  avatarDefaultKey: string | null;
  coverImageId: string | null;
  bio: string | null;
  regionCode: string | null;
};

export type UpdateMyProfileResult =
  | { ok: true; profile: MyProfile }
  | { ok: false; error: "VALIDATION_FAILED"; errors: ProfileErrors }
  | { ok: false; error: "NOT_FOUND" };

/** The signed-in player's own profile fields (never email or password hash), or null. */
export async function getMyProfile(userId: string): Promise<MyProfile | null> {
  if (typeof userId !== "string" || !userId) return null;
  return db.user.findUnique({ where: { id: userId }, select: MY_PROFILE_SELECT });
}

/**
 * Applies a partial profile change. Unknown keys, bad lengths and regions outside the list are
 * refused; image ids must be the player's own, of kind AVATAR (avatar) or COVER (cover).
 * Choosing an uploaded avatar clears the default key and the other way round.
 */
export async function updateMyProfile(
  userId: string,
  input: unknown,
): Promise<UpdateMyProfileResult> {
  const parsed = parseProfileUpdate(input);
  if (!parsed.ok) return { ok: false, error: "VALIDATION_FAILED", errors: parsed.errors };
  const { avatarImageId, coverImageId, ...rest } = parsed.data;
  const errors: ProfileErrors = {};
  const owned = async (id: string | null | undefined, kind: "AVATAR" | "COVER") =>
    !id || (await db.imageAsset.count({ where: { id, ownerId: userId, kind } })) === 1;
  if (!(await owned(avatarImageId, "AVATAR"))) errors.avatarImageId = "IMAGE_INVALID";
  if (!(await owned(coverImageId, "COVER"))) errors.coverImageId = "IMAGE_INVALID";
  if (Object.keys(errors).length) return { ok: false, error: "VALIDATION_FAILED", errors };

  const data = { ...rest, avatarImageId, coverImageId };
  if (avatarImageId) data.avatarDefaultKey = null;
  else if (rest.avatarDefaultKey) data.avatarImageId = null;
  const defined = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
  try {
    const profile = await db.user.update({
      where: { id: userId },
      data: defined,
      select: MY_PROFILE_SELECT,
    });
    return { ok: true, profile };
  } catch (error) {
    if ((error as { code?: string }).code === "P2025") return { ok: false, error: "NOT_FOUND" };
    throw error;
  }
}
