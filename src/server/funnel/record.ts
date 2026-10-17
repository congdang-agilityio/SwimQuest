import type { Prisma } from "@prisma/client";

/**
 * Product funnel events (SRC-10, S-81). The names are a closed list. Release 1 has no email
 * verification and no join requests (Q-01, Q-49), so `account_verification_completed` and
 * `tournament_join_requested` are left out on purpose.
 */
export const FUNNEL_EVENTS = [
  "account_signup_started",
  "account_signup_completed",
  "profile_setup_completed",
  "tournament_create_started",
  "tournament_created",
  "tournament_published",
  "tournament_viewed",
  "tournament_joined",
  "team_created",
  "team_invite_sent",
  "team_invite_accepted",
  "route_start_options_viewed",
  "route_start_selected",
  "route_start_locked",
  "activity_submitted",
  "activity_verification_passed",
  "activity_verification_failed",
  "route_progress_changed",
  "route_finish_reached",
  "score_recalculated",
  "admin_override",
] as const;

export type FunnelEventName = (typeof FUNNEL_EVENTS)[number];

/** The only keys `props` may hold. Labels and counts, never personal data. */
const PROP_KEYS = new Set([
  "action",
  "status",
  "previousStatus",
  "startId",
  "fromBp",
  "toBp",
  "source",
  "count",
]);

export type FunnelProps = Partial<Record<string, string | number | boolean>>;

export type FunnelOptions = {
  userId?: string | null;
  tournamentId?: string | null;
  refId?: string | null;
  props?: FunnelProps;
  /** Records the event once: the row's `dedupeKey` is `<name>:<once>` and repeats are ignored. */
  once?: string;
};

/** Any client that can write funnel events, typically the `tx` of `db.$transaction`. */
export type FunnelClient = {
  funnelEvent: {
    createMany(args: {
      data: Prisma.FunnelEventCreateManyInput[];
      skipDuplicates?: boolean;
    }): PromiseLike<unknown>;
  };
};

export class FunnelEventError extends Error {}

const NAMES = new Set<string>(FUNNEL_EVENTS);
/** Ids, enum labels and route keys: letters, digits and `_ . : -`; no "@", spaces or commas. */
const SAFE = /^[A-Za-z0-9_.:-]{1,80}$/;
/** A bare decimal such as "10.7769" could be a coordinate. */
const DECIMAL = /^-?\d+\.\d+$/;

function safeString(value: string, what: string): string {
  if (!SAFE.test(value) || DECIMAL.test(value)) {
    throw new FunnelEventError(`Funnel ${what} is not an id-like value`);
  }
  return value;
}

function cleanProps(props: FunnelProps): Prisma.InputJsonObject {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue;
    if (!PROP_KEYS.has(key)) throw new FunnelEventError(`Funnel prop "${key}" is not allowed`);
    if (typeof value === "string") out[key] = safeString(value, `prop "${key}"`);
    // Whole numbers only: decimals could carry coordinates.
    else if (typeof value === "number" && Number.isSafeInteger(value)) out[key] = value;
    else if (typeof value === "boolean") out[key] = value;
    else throw new FunnelEventError(`Funnel prop "${key}" has a value that is not allowed`);
  }
  return out;
}

function buildRow(name: string, o: FunnelOptions): Prisma.FunnelEventCreateManyInput {
  if (!NAMES.has(name)) throw new FunnelEventError(`Unknown funnel event "${name}"`);
  const id = (v: string | null | undefined, what: string) =>
    v === undefined || v === null ? null : safeString(v, what);
  const props = o.props ? cleanProps(o.props) : undefined;
  return {
    name,
    userId: id(o.userId, "userId"),
    tournamentId: id(o.tournamentId, "tournamentId"),
    refId: id(o.refId, "refId"),
    ...(props && Object.keys(props).length > 0 ? { props } : {}),
    dedupeKey: o.once === undefined ? null : `${name}:${safeString(o.once, "once key")}`,
  };
}

/**
 * Records one funnel event with the caller's client, so it commits or rolls back with the
 * action. A "once" event is an insert-or-ignore on `dedupeKey` (no error on a repeat, so the
 * transaction is never aborted). Bad input is a programming error: it throws outside
 * production, and in production it is logged and skipped so the main action never fails.
 */
export async function recordFunnelEvent(
  client: FunnelClient,
  name: FunnelEventName,
  options: FunnelOptions = {},
): Promise<void> {
  let row: Prisma.FunnelEventCreateManyInput;
  try {
    row = buildRow(name, options);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") throw error;
    console.error("funnel: event skipped", error);
    return;
  }
  await client.funnelEvent.createMany({ data: [row], skipDuplicates: true });
}
