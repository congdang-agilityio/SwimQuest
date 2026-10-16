-- CreateEnum
CREATE TYPE "ImageKind" AS ENUM ('AVATAR', 'COVER', 'TOURNAMENT_BANNER', 'TOURNAMENT_LOGO');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarDefaultKey" TEXT,
ADD COLUMN     "avatarImageId" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "coverImageId" TEXT,
ADD COLUMN     "disciplines" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "goalDistanceM" INTEGER,
ADD COLUMN     "goalsText" TEXT,
ADD COLUMN     "locale" TEXT,
ADD COLUMN     "privacy" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "regionCode" TEXT;

-- CreateTable
CREATE TABLE "ImageAsset" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "kind" "ImageKind" NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImageAsset_ownerId_kind_idx" ON "ImageAsset"("ownerId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "User_avatarImageId_key" ON "User"("avatarImageId");

-- CreateIndex
CREATE UNIQUE INDEX "User_coverImageId_key" ON "User"("coverImageId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_avatarImageId_fkey" FOREIGN KEY ("avatarImageId") REFERENCES "ImageAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_coverImageId_fkey" FOREIGN KEY ("coverImageId") REFERENCES "ImageAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageAsset" ADD CONSTRAINT "ImageAsset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A region is a short province or city code, never a free-text address.
ALTER TABLE "User" ADD CONSTRAINT "User_regionCode_check" CHECK ("regionCode" ~ '^[A-Za-z0-9_-]{1,32}$');
