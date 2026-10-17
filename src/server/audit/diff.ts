import type { Prisma } from "@prisma/client";

export type FieldChanges = {
  before: Record<string, Prisma.InputJsonValue | null>;
  after: Record<string, Prisma.InputJsonValue | null>;
};

const json = (value: unknown) => (value === undefined ? null : JSON.parse(JSON.stringify(value)));

/**
 * The fields of `after` whose value differs from `before`, as JSON snapshots (dates become ISO
 * strings, a missing value null). Only fields named in `after` are compared, so a partial edit
 * lists only what it set. Empty `before` and `after` mean nothing changed.
 */
export function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): FieldChanges {
  const changes: FieldChanges = { before: {}, after: {} };
  for (const [field, value] of Object.entries(after)) {
    if (value === undefined) continue;
    const was = json(before[field]);
    const now = json(value);
    if (JSON.stringify(was) === JSON.stringify(now)) continue;
    changes.before[field] = was;
    changes.after[field] = now;
  }
  return changes;
}
