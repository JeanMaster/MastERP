-- AlterTable
ALTER TABLE "company_settings" ADD COLUMN     "roundingEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "roundingFactor" INTEGER NOT NULL DEFAULT 10;
