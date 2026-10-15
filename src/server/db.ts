import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

function lowerEmail<T extends { email?: unknown }>(data: T): T {
  return typeof data.email === "string" ? { ...data, email: data.email.toLowerCase() } : data;
}

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter }).$extends({
    query: {
      user: {
        create: ({ args, query }) => query({ ...args, data: lowerEmail(args.data) }),
        update: ({ args, query }) => query({ ...args, data: lowerEmail(args.data) }),
        upsert: ({ args, query }) =>
          query({ ...args, create: lowerEmail(args.create), update: lowerEmail(args.update) }),
      },
    },
  });
}

const globalForDb = globalThis as unknown as { db?: ReturnType<typeof createClient> };

/** Shared Prisma client; one instance per process (survives Next.js dev reloads). */
export const db = globalForDb.db ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.db = db;
