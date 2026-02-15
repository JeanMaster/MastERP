-- AlterTable
ALTER TABLE "bank_accounts" ADD COLUMN     "pendingLiquidation" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "receivesPosLiquidation" BOOLEAN NOT NULL DEFAULT false;
