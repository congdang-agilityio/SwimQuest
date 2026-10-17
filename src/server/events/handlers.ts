import { teamBadgeHandlers } from "../badges/team-badges";
import { funnelHandlers } from "../funnel/handlers";
import { notificationHandlers } from "../notifications/handlers";
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

/**
 * Registers a handler for one event type. Feature modules export their handlers; this module
 * registers them at the bottom of the file, below the registry, so there is no import cycle.
 */
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

export function registerNotificationHandlers(): void {
  for (const [type, fn] of Object.entries(notificationHandlers)) {
    registry.set(type as DomainEventType, [
      ...(registry.get(type as DomainEventType) ?? []),
      fn as EventHandler<never>,
    ]);
  }
}
registerNotificationHandlers();

/**
 * Team badges (S-49): Explorer at 50%, Lý Sơn on the finish, removed on its withdrawal and from
 * a player moved off the team.
 */
export function registerTeamBadgeHandlers(): void {
  for (const [type, fn] of Object.entries(teamBadgeHandlers)) {
    registry.set(type as DomainEventType, [
      ...(registry.get(type as DomainEventType) ?? []),
      fn as EventHandler<never>,
    ]);
  }
}
registerTeamBadgeHandlers();

/** Product funnel events (S-81): domain events mapped to SRC-10 funnel names. */
export function registerFunnelHandlers(): void {
  for (const [type, fn] of Object.entries(funnelHandlers)) {
    registry.set(type as DomainEventType, [
      ...(registry.get(type as DomainEventType) ?? []),
      fn as EventHandler<never>,
    ]);
  }
}
registerFunnelHandlers();
