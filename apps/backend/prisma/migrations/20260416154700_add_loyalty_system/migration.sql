-- CreateEnum
CREATE TYPE "LoyaltyMovementType" AS ENUM ('EARNED', 'REDEEMED', 'ADJUSTMENT');

-- AlterTable: Add pointsPerUSD to marketing_config
ALTER TABLE "marketing_config" ADD COLUMN IF NOT EXISTS "pointsPerUSD" DECIMAL(10,2) NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE IF NOT EXISTS "loyalty_movements" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "saleId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "type" "LoyaltyMovementType" NOT NULL,
    "notes" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_movements_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "loyalty_movements" ADD CONSTRAINT "loyalty_movements_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_movements" ADD CONSTRAINT "loyalty_movements_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
