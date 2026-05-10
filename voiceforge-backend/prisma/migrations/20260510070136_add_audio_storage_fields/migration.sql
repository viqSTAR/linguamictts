-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastAudioKey" TEXT,
ADD COLUMN     "lastAudioUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "lastAudioUrl" TEXT;
