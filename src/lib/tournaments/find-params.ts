export const FIND_FILTERS = ["open", "PUBLISHED", "ACTIVE", "COMPLETED"] as const;
export type FindFilter = (typeof FIND_FILTERS)[number];

/** Builds the Find tournaments address; `open` (the default) and empty values are left out. */
export function findHref(q: string, filter: FindFilter, cursor?: string): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (filter !== "open") params.set("status", filter);
  if (cursor) params.set("cursor", cursor);
  const qs = params.toString();
  return qs ? `/tournaments/find?${qs}` : "/tournaments/find";
}
