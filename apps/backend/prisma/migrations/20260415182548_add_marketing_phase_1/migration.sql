-- AlterTable
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3);
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "loyaltyPoints" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "marketing_config" (
    "id" TEXT NOT NULL,
    "tierVipThreshold" DECIMAL(10,2) NOT NULL DEFAULT 1000,
    "tierGoldThreshold" DECIMAL(10,2) NOT NULL DEFAULT 500,
    "tierSilverThreshold" DECIMAL(10,2) NOT NULL DEFAULT 200,
    "churnDays" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_config_pkey" PRIMARY KEY ("id")
);
