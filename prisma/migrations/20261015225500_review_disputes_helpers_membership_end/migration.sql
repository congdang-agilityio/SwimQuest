-- CreateEnum
CREATE TYPE "TeamMemberEndReason" AS ENUM ('LEFT', 'SWITCHED', 'MOVED', 'REMOVED_BEFORE_START', 'REMOVED_AFTER_START');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "SwimResult" ADD COLUMN     "decidedAt" TIMESTAMPTZ(3),
ADD COLUMN     "decidedById" TEXT,
ADD COLUMN     "decisionNote" TEXT;

-- AlterTable
ALTER TABLE "TeamMember" ADD COLUMN     "endReason" "TeamMemberEndReason",
ADD COLUMN     "endedAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "swimResultId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "previousStatus" "SwimResultStatus" NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMPTZ(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewHelper" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "appointedById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ReviewHelper_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Dispute_swimResultId_idx" ON "Dispute"("swimResultId");

-- CreateIndex
CREATE UNIQUE INDEX "Dispute_one_open_per_result" ON "Dispute"("swimResultId") WHERE ("status" = 'OPEN');

-- CreateIndex
CREATE INDEX "ReviewHelper_userId_idx" ON "ReviewHelper"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewHelper_one_active_per_tournament" ON "ReviewHelper"("tournamentId", "userId") WHERE ("removedAt" IS NULL);

-- AddForeignKey
ALTER TABLE "SwimResult" ADD CONSTRAINT "SwimResult_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_swimResultId_fkey" FOREIGN KEY ("swimResultId") REFERENCES "SwimResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewHelper" ADD CONSTRAINT "ReviewHelper_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewHelper" ADD CONSTRAINT "ReviewHelper_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewHelper" ADD CONSTRAINT "ReviewHelper_appointedById_fkey" FOREIGN KEY ("appointedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
