-- AlterTable
-- Same default the baseline already created; this keeps the Prisma schema in sync so the
-- client no longer generates createdAt itself.
ALTER TABLE "AuditEvent" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
