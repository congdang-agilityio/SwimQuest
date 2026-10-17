import type { Prisma, ZaloMessageKind } from "@prisma/client";
import { renderIntro } from "./messages/intro";

/** The stored payload of a queued message (`payload.parts` for merged messages). */
export type ZaloStoredPayload = Record<string, Prisma.JsonValue>;

/**
 * Builds the Vietnamese text of one message from its payload and the current data, or null
 * when there is nothing left to say (for example the tournament was deleted).
 */
export type ZaloRenderer = (payload: ZaloStoredPayload) => Promise<string | null>;

/** One renderer per message kind; each message task registers its own. */
const RENDERERS: Partial<Record<ZaloMessageKind, ZaloRenderer>> = {
  INTRO: renderIntro,
};

/** Whether this kind can be sent yet; messages of other kinds wait in the queue. */
export function hasRenderer(kind: ZaloMessageKind): boolean {
  return RENDERERS[kind] !== undefined;
}

/** The text for a queued message, or null when its kind has no renderer or nothing to say. */
export async function renderZalo(
  kind: ZaloMessageKind,
  payload: ZaloStoredPayload,
): Promise<string | null> {
  const renderer = RENDERERS[kind];
  if (!renderer) return null;
  const text = await renderer(payload);
  return text && text.trim() ? text : null;
}
