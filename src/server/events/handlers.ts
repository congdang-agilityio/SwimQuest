import type { db } from "../db";
import type { DomainEventMap, DomainEventType } from "./types";

/** The transaction client handed to every handler (the caller's `tx`). */
export type EventTx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/** Runs inside the emitter's transaction: keep it fast and DB-only. A throw rolls everything back. */
export type EventHandler<T extends DomainEventType> = (
  tx: EventTx,
  payload: DomainEventMap[T],
) => Promise<void> | void;

const registry = new Map<DomainEventType, EventHandler<never>[]>();

/** Registers a handler for one event type. Later features call this from this module's importers. */
export function registerHandler<T extends DomainEventType>(type: T, fn: EventHandler<T>): void {
  registry.set(type, [...(registry.get(type) ?? []), fn as EventHandler<never>]);
}

/** Handlers for a type, in registration order. */
export function handlersFor<T extends DomainEventType>(type: T): EventHandler<T>[] {
  return (registry.get(type) ?? []) as EventHandler<T>[];
}

/** Test helper: removes every registered handler. */
export function clearHandlers(): void {
  registry.clear();
}

// Concrete handlers (notifications, badges) are registered here by later tasks.
