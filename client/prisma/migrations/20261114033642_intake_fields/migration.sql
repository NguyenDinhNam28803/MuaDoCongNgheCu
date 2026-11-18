-- AlterTable
ALTER TABLE "Acquisition" ADD COLUMN     "sellerConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sourceName" TEXT;
