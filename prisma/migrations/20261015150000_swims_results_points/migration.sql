-- CreateEnum
CREATE TYPE "SwimSource" AS ENUM ('GPX', 'FIT');

-- CreateEnum
CREATE TYPE "SwimType" AS ENUM ('POOL', 'OPEN_WATER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SwimResultStatus" AS ENUM ('VERIFIED', 'FLAGGED', 'REJECTED', 'DUPLICATE', 'DISPUTED', 'REVOKED', 'RULE_MISSED');

-- CreateEnum
CREATE TYPE "PointsKind" AS ENUM ('DISTANCE', 'FIRST_SWIM_BONUS', 'LONG_SWIM_BONUS', 'WEEKLY_MULTIPLIER', 'REVERSAL');

-- CreateTable
CREATE TABLE "Swim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "SwimSource" NOT NULL,
    "fileSha256" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "endedAt" TIMESTAMPTZ(3) NOT NULL,
    "distanceM" INTEGER NOT NULL,
    "durationS" INTEGER NOT NULL,
    "swimType" "SwimType" NOT NULL,
    "sport" TEXT NOT NULL,
    "isSwim" BOOLEAN NOT NULL,
    "duplicateOfId" TEXT,
    "track" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Swim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SwimResult" (
    "id" TEXT NOT NULL,
    "swimId" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SwimResultStatus" NOT NULL,
    "reasons" JSONB NOT NULL,
    "countedM" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SwimResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointsEntry" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "swimResultId" TEXT,
    "kind" "PointsKind" NOT NULL,
    "points" INTEGER NOT NULL,
    "countedM" INTEGER NOT NULL DEFAULT 0,
    "vnDay" CHAR(10) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointsEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Swim_userId_startedAt_idx" ON "Swim"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "Swim_userId_fileSha256_idx" ON "Swim"("userId", "fileSha256");

-- CreateIndex
CREATE INDEX "SwimResult_tournamentId_status_idx" ON "SwimResult"("tournamentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SwimResult_swimId_tournamentId_key" ON "SwimResult"("swimId", "tournamentId");

-- CreateIndex
CREATE INDEX "PointsEntry_tournamentId_userId_vnDay_idx" ON "PointsEntry"("tournamentId", "userId", "vnDay");

-- CreateIndex
CREATE INDEX "PointsEntry_tournamentId_teamId_createdAt_idx" ON "PointsEntry"("tournamentId", "teamId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PointsEntry_swimResultId_kind_key" ON "PointsEntry"("swimResultId", "kind");

-- AddForeignKey
ALTER TABLE "Swim" ADD CONSTRAINT "Swim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Swim" ADD CONSTRAINT "Swim_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "Swim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwimResult" ADD CONSTRAINT "SwimResult_swimId_fkey" FOREIGN KEY ("swimId") REFERENCES "Swim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwimResult" ADD CONSTRAINT "SwimResult_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwimResult" ADD CONSTRAINT "SwimResult_teamId_tournamentId_fkey" FOREIGN KEY ("teamId", "tournamentId") REFERENCES "Team"("id", "tournamentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwimResult" ADD CONSTRAINT "SwimResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsEntry" ADD CONSTRAINT "PointsEntry_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsEntry" ADD CONSTRAINT "PointsEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsEntry" ADD CONSTRAINT "PointsEntry_teamId_tournamentId_fkey" FOREIGN KEY ("teamId", "tournamentId") REFERENCES "Team"("id", "tournamentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsEntry" ADD CONSTRAINT "PointsEntry_swimResultId_fkey" FOREIGN KEY ("swimResultId") REFERENCES "SwimResult"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- Hand-written: Prisma does not model check constraints.
ALTER TABLE "Swim" ADD CONSTRAINT "Swim_distanceM_check" CHECK ("distanceM" >= 0);
ALTER TABLE "Swim" ADD CONSTRAINT "Swim_durationS_check" CHECK ("durationS" >= 0);
ALTER TABLE "SwimResult" ADD CONSTRAINT "SwimResult_countedM_check" CHECK ("countedM" >= 0);
ALTER TABLE "SwimResult" ADD CONSTRAINT "SwimResult_reasons_check" CHECK (jsonb_typeof("reasons") = 'array');
ALTER TABLE "PointsEntry" ADD CONSTRAINT "PointsEntry_vnDay_check" CHECK ("vnDay" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
