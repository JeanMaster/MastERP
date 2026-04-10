-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "isTaxable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
