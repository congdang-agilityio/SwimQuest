-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "finishLostAt" TIMESTAMPTZ(3),
ADD COLUMN     "finishLostReason" TEXT,
ADD COLUMN     "finishedAt" TIMESTAMPTZ(3),
ADD COLUMN     "progressBp" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DomainEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tournamentId" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeenMoment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "seenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeenMoment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyResult" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "weekStart" CHAR(10) NOT NULL,
    "activeDays" INTEGER NOT NULL,
    "multiplierPct" INTEGER NOT NULL,
    "distancePoints" INTEGER NOT NULL,
    "extraPoints" INTEGER NOT NULL,
    "streakWeeks" INTEGER NOT NULL,
    "settledAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WeeklyResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeekSettlement" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "weekStart" CHAR(10) NOT NULL,
    "settledAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeekSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DomainEvent_tournamentId_createdAt_idx" ON "DomainEvent"("tournamentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SeenMoment_userId_key_key" ON "SeenMoment"("userId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyResult_tournamentId_userId_weekStart_key" ON "WeeklyResult"("tournamentId", "userId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "WeekSettlement_tournamentId_weekStart_key" ON "WeekSettlement"("tournamentId", "weekStart");

-- AddForeignKey
ALTER TABLE "SeenMoment" ADD CONSTRAINT "SeenMoment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyResult" ADD CONSTRAINT "WeeklyResult_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyResult" ADD CONSTRAINT "WeeklyResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyResult" ADD CONSTRAINT "WeeklyResult_teamId_tournamentId_fkey" FOREIGN KEY ("teamId", "tournamentId") REFERENCES "Team"("id", "tournamentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekSettlement" ADD CONSTRAINT "WeekSettlement_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written: Prisma does not model check constraints.
ALTER TABLE "Team" ADD CONSTRAINT "Team_progressBp_check" CHECK ("progressBp" >= 0);
ALTER TABLE "WeeklyResult" ADD CONSTRAINT "WeeklyResult_weekStart_check" CHECK ("weekStart" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
ALTER TABLE "WeekSettlement" ADD CONSTRAINT "WeekSettlement_weekStart_check" CHECK ("weekStart" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
