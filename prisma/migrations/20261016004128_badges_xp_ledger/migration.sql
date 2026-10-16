-- CreateEnum
CREATE TYPE "BadgeKind" AS ENUM ('PARTICIPATION', 'EXPLORER', 'PERSEVERANCE', 'TEAMWORK', 'CONQUEROR', 'SEASON', 'SPECIAL', 'LY_SON');

-- CreateEnum
CREATE TYPE "XpKind" AS ENUM ('DISTANCE', 'FIRST_SWIM_BONUS', 'LONG_SWIM_BONUS', 'WEEKLY_MULTIPLIER', 'REVERSAL');

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT,
    "kind" "BadgeKind" NOT NULL,
    "reason" TEXT,
    "givenById" TEXT,
    "awardedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMPTZ(3),
    "removedReason" TEXT,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "swimId" TEXT,
    "weekStart" CHAR(10),
    "kind" "XpKind" NOT NULL,
    "xp" INTEGER NOT NULL,
    "vnDay" CHAR(10),
    "reversesId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpWeek" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" CHAR(10) NOT NULL,
    "multiplierPct" INTEGER NOT NULL,
    "extraXp" INTEGER NOT NULL,
    "settledAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "XpWeek_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Badge_userId_awardedAt_idx" ON "Badge"("userId", "awardedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_one_active_per_kind" ON "Badge"("tournamentId", "userId", "kind") WHERE ("removedAt" IS NULL);

-- CreateIndex
CREATE INDEX "XpEntry_userId_idx" ON "XpEntry"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "XpEntry_swimId_kind_key" ON "XpEntry"("swimId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "XpWeek_userId_weekStart_key" ON "XpWeek"("userId", "weekStart");

-- AddForeignKey
ALTER TABLE "Badge" ADD CONSTRAINT "Badge_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Badge" ADD CONSTRAINT "Badge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Badge" ADD CONSTRAINT "Badge_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Badge" ADD CONSTRAINT "Badge_givenById_fkey" FOREIGN KEY ("givenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpEntry" ADD CONSTRAINT "XpEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpEntry" ADD CONSTRAINT "XpEntry_swimId_fkey" FOREIGN KEY ("swimId") REFERENCES "Swim"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpEntry" ADD CONSTRAINT "XpEntry_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "XpEntry"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpWeek" ADD CONSTRAINT "XpWeek_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written: day strings are "YYYY-MM-DD" (Vietnam calendar).
ALTER TABLE "XpEntry" ADD CONSTRAINT "XpEntry_vnDay_check" CHECK ("vnDay" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
ALTER TABLE "XpEntry" ADD CONSTRAINT "XpEntry_weekStart_check" CHECK ("weekStart" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
ALTER TABLE "XpWeek" ADD CONSTRAINT "XpWeek_weekStart_check" CHECK ("weekStart" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
