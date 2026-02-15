/*
  Warnings:

  - A unique constraint covering the columns `[bankMovementId]` on the table `purchase_payments` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "purchase_payments" ADD COLUMN     "bankAccountId" TEXT,
ADD COLUMN     "bankMovementId" TEXT,
ADD COLUMN     "currencyCode" TEXT NOT NULL DEFAULT 'VES',
ADD COLUMN     "exchangeRate" DECIMAL(10,4) NOT NULL DEFAULT 1.0,
ADD COLUMN     "paymentAmount" DECIMAL(10,2);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_payments_bankMovementId_key" ON "purchase_payments"("bankMovementId");

-- AddForeignKey
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_bankMovementId_fkey" FOREIGN KEY ("bankMovementId") REFERENCES "bank_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
