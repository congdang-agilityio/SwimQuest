-- CreateEnum
CREATE TYPE "ZaloMessageKind" AS ENUM ('INTRO', 'NEW_TEAM', 'PLAYER_JOINED', 'PLAYER_MOVED', 'SEASON_START', 'COUNTED_SWIM', 'MILESTONE', 'SEASON_END');

-- CreateEnum
CREATE TYPE "ZaloMessageStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "seasonStartProcessedAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "ZaloBot" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "botName" TEXT NOT NULL,
    "tokenEnc" TEXT NOT NULL,
    "tokenHint" TEXT NOT NULL,
    "hookId" TEXT NOT NULL,
    "secretEnc" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "webhookOk" BOOLEAN NOT NULL DEFAULT false,
    "chatId" TEXT,
    "linkedAt" TIMESTAMPTZ(3),
    "lastError" TEXT,
    "lastErrorAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ZaloBot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentZalo" (
    "tournamentId" TEXT NOT NULL,
    "zaloBotId" TEXT NOT NULL,
    "notifyNewTeam" BOOLEAN NOT NULL DEFAULT true,
    "notifyPlayerJoined" BOOLEAN NOT NULL DEFAULT true,
    "notifyPlayerMoved" BOOLEAN NOT NULL DEFAULT true,
    "notifySeasonStart" BOOLEAN NOT NULL DEFAULT true,
    "notifyCountedSwims" BOOLEAN NOT NULL DEFAULT true,
    "notifyMilestones" BOOLEAN NOT NULL DEFAULT true,
    "notifySeasonEnd" BOOLEAN NOT NULL DEFAULT true,
    "introPostedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TournamentZalo_pkey" PRIMARY KEY ("tournamentId")
);

-- CreateTable
CREATE TABLE "ZaloMessage" (
    "id" TEXT NOT NULL,
    "zaloBotId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "kind" "ZaloMessageKind" NOT NULL,
    "payload" JSONB NOT NULL,
    "groupKey" TEXT,
    "dedupeKey" TEXT,
    "status" "ZaloMessageStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMPTZ(3),

    CONSTRAINT "ZaloMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZaloSwimPost" (
    "swimResultId" TEXT NOT NULL,
    "zaloMessageId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZaloSwimPost_pkey" PRIMARY KEY ("swimResultId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ZaloBot_hookId_key" ON "ZaloBot"("hookId");

-- CreateIndex
CREATE UNIQUE INDEX "ZaloBot_ownerUserId_botId_key" ON "ZaloBot"("ownerUserId", "botId");

-- CreateIndex
CREATE INDEX "TournamentZalo_zaloBotId_idx" ON "TournamentZalo"("zaloBotId");

-- CreateIndex
CREATE UNIQUE INDEX "ZaloMessage_dedupeKey_key" ON "ZaloMessage"("dedupeKey");

-- CreateIndex
CREATE INDEX "ZaloMessage_groupKey_idx" ON "ZaloMessage"("groupKey");

-- CreateIndex
CREATE INDEX "ZaloMessage_status_createdAt_idx" ON "ZaloMessage"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ZaloSwimPost_zaloMessageId_idx" ON "ZaloSwimPost"("zaloMessageId");

-- AddForeignKey
ALTER TABLE "ZaloBot" ADD CONSTRAINT "ZaloBot_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentZalo" ADD CONSTRAINT "TournamentZalo_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentZalo" ADD CONSTRAINT "TournamentZalo_zaloBotId_fkey" FOREIGN KEY ("zaloBotId") REFERENCES "ZaloBot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZaloMessage" ADD CONSTRAINT "ZaloMessage_zaloBotId_fkey" FOREIGN KEY ("zaloBotId") REFERENCES "ZaloBot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZaloSwimPost" ADD CONSTRAINT "ZaloSwimPost_swimResultId_fkey" FOREIGN KEY ("swimResultId") REFERENCES "SwimResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZaloSwimPost" ADD CONSTRAINT "ZaloSwimPost_zaloMessageId_fkey" FOREIGN KEY ("zaloMessageId") REFERENCES "ZaloMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

