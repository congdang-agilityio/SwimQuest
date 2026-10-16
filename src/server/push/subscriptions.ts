import { z } from "zod";
import { db } from "@/server/db";

const MAX_ENDPOINT = 2048;
const MAX_KEY = 512;

/** A browser `PushSubscription.toJSON()` payload. The endpoint must be https. */
export const subscriptionSchema = z.object({
  endpoint: z
    .string()
    .max(MAX_ENDPOINT)
    .refine((v) => {
      try {
        return new URL(v).protocol === "https:";
      } catch {
        return false;
      }
    }, "NOT_HTTPS"),
  keys: z.object({
    p256dh: z.string().min(1).max(MAX_KEY),
    auth: z.string().min(1).max(MAX_KEY),
  }),
});

export type PushSubscriptionInput = z.infer<typeof subscriptionSchema>;

/**
 * Registers a device for the user. The endpoint identifies the device: re-saving updates its
 * keys, and an endpoint owned by another account moves to this user.
 */
export async function saveSubscription(userId: string, sub: PushSubscriptionInput): Promise<void> {
  const parsed = subscriptionSchema.parse(sub);
  const data = { userId, p256dh: parsed.keys.p256dh, auth: parsed.keys.auth };
  await db.pushSubscription.upsert({
    where: { endpoint: parsed.endpoint },
    create: { endpoint: parsed.endpoint, ...data },
    update: data,
  });
}

/** Removes only this user's subscription for the endpoint; other devices stay. */
export async function removeSubscription(userId: string, endpoint: string): Promise<void> {
  await db.pushSubscription.deleteMany({ where: { userId, endpoint } });
}
