-- Product funnel events and client health signals (S-81, #409). No email, GPS or track columns.
-- CreateEnum
CREATE TYPE "HealthSignalKind" AS ENUM ('API_FAILURE', 'ASSET_FAILURE');

-- CreateTable
CREATE TABLE "FunnelEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT,
    "tournamentId" TEXT,
    "refId" TEXT,
    "props" JSONB,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunnelEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthSignal" (
    "id" TEXT NOT NULL,
    "kind" "HealthSignalKind" NOT NULL,
    "path" VARCHAR(200) NOT NULL,
    "status" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FunnelEvent_dedupeKey_key" ON "FunnelEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "FunnelEvent_name_createdAt_idx" ON "FunnelEvent"("name", "createdAt");

-- CreateIndex
CREATE INDEX "HealthSignal_kind_createdAt_idx" ON "HealthSignal"("kind", "createdAt");

-- AddForeignKey
ALTER TABLE "FunnelEvent" ADD CONSTRAINT "FunnelEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

