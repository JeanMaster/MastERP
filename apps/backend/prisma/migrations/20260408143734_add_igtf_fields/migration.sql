-- AlterTable
ALTER TABLE "company_settings" ADD COLUMN     "igtfEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "igtfRate" DECIMAL(5,2) NOT NULL DEFAULT 3.00;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "igtfAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
