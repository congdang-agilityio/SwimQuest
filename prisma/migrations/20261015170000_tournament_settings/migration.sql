-- CreateEnum
CREATE TYPE "SwimTypeAllowed" AS ENUM ('ANY', 'POOL_ONLY', 'OPEN_WATER_ONLY');

-- CreateEnum
CREATE TYPE "TournamentVisibility" AS ENUM ('PUBLIC', 'INVITE_ONLY');

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "archivedAt" TIMESTAMPTZ(3),
ADD COLUMN     "bannerImageId" TEXT,
ADD COLUMN     "contactChannel" TEXT,
ADD COLUMN     "eligibilityNotes" TEXT,
ADD COLUMN     "extraSlowestPaceSecPer100m" INTEGER,
ADD COLUMN     "firstSwimBonusPoints" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "inviteEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lateUploadDays" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "logoImageId" TEXT,
ADD COLUMN     "longSwimTier1M" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN     "longSwimTier1Points" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "longSwimTier2M" INTEGER NOT NULL DEFAULT 3000,
ADD COLUMN     "longSwimTier2Points" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN     "minSwimDistanceM" INTEGER,
ADD COLUMN     "multiplierMaxPct" INTEGER NOT NULL DEFAULT 140,
ADD COLUMN     "multiplierThreeDaysPct" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN     "multiplierTwoDaysPct" INTEGER NOT NULL DEFAULT 110,
ADD COLUMN     "rulesText" TEXT,
ADD COLUMN     "rulesUrl" TEXT,
ADD COLUMN     "seasonEndProcessedAt" TIMESTAMPTZ(3),
ADD COLUMN     "streakStepPct" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "submissionDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "swimLimitBounds" JSONB,
ADD COLUMN     "swimTypeAllowed" "SwimTypeAllowed" NOT NULL DEFAULT 'ANY',
ADD COLUMN     "visibility" "TournamentVisibility";
