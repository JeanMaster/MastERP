/*
  Warnings:

  - A unique constraint covering the columns `[bankMovementId]` on the table `expenses` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "bankAccountId" TEXT,
ADD COLUMN     "bankMovementId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "expenses_bankMovementId_key" ON "expenses"("bankMovementId");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_bankMovementId_fkey" FOREIGN KEY ("bankMovementId") REFERENCES "bank_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
