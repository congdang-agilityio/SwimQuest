import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

type EmailInput = { email?: unknown };

function lower(value: unknown): unknown {
  if (typeof value === "string") return value.toLowerCase();
  if (value && typeof value === "object" && typeof (value as { set?: unknown }).set === "string") {
    return { ...value, set: (value as { set: string }).set.toLowerCase() };
  }
  return value;
}

/** Lower-cases `email` (plain or `{ set }`) in one data object or in an array of them. */
function lowerEmail<T>(data: T): T {
  if (Array.isArray(data)) return data.map((item) => lowerEmail(item)) as T;
  const input = data as EmailInput;
  return input && "email" in input ? ({ ...input, email: lower(input.email) } as T) : data;
}

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter }).$extends({
    query: {
      user: {
        create: ({ args, query }) => query({ ...args, data: lowerEmail(args.data) }),
        createMany: ({ args, query }) => query({ ...args, data: lowerEmail(args.data) }),
        createManyAndReturn: ({ args, query }) => query({ ...args, data: lowerEmail(args.data) }),
        update: ({ args, query }) => query({ ...args, data: lowerEmail(args.data) }),
        updateMany: ({ args, query }) => query({ ...args, data: lowerEmail(args.data) }),
        updateManyAndReturn: ({ args, query }) => query({ ...args, data: lowerEmail(args.data) }),
        upsert: ({ args, query }) =>
          query({ ...args, create: lowerEmail(args.create), update: lowerEmail(args.update) }),
      },
    },
  });
}

const globalForDb = globalThis as unknown as { db?: ReturnType<typeof createClient> };

/**
 * Shared Prisma client; one instance per process (survives Next.js dev reloads).
 * Emails are lower-cased on every write, and the database rejects any that are not.
 * `where` clauses are not normalized: callers lower-case lookup emails (e.g. with Zod) first.
 */
export const db = globalForDb.db ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.db = db;
