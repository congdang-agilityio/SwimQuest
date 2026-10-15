import { handlersFor, type EventTx } from "./handlers";
import type { DomainEventInput } from "./types";

/**
 * Stores the event in the caller's transaction, then awaits each registered handler with the
 * same `tx`. A throwing handler rejects, so the caller's transaction rolls back with it.
 */
export async function emitEvent(tx: EventTx, event: DomainEventInput): Promise<void> {
  const payload = event.payload as { tournamentId?: string };
  await tx.domainEvent.create({
    data: {
      type: event.type,
      tournamentId: payload.tournamentId ?? null,
      payload,
    },
  });
  for (const handler of handlersFor(event.type)) {
    await (handler as (tx: EventTx, payload: unknown) => Promise<void> | void)(tx, event.payload);
  }
}
