-- AlterTable
ALTER TABLE "company_settings" ADD COLUMN     "taxEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 16.00;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "isTaxExempt" BOOLEAN NOT NULL DEFAULT false;
