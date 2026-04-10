-- AlterTable
ALTER TABLE "company_settings" ADD COLUMN     "isSpecialTaxpayer" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "tax_retentions" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "voucherNumber" TEXT NOT NULL,
    "voucherDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(10,2) NOT NULL,
    "baseAmount" DECIMAL(10,2) NOT NULL,
    "retentionPercent" DECIMAL(5,2) NOT NULL,
    "invoiceId" TEXT,
    "purchaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_retentions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tax_retentions_voucherNumber_key" ON "tax_retentions"("voucherNumber");

-- AddForeignKey
ALTER TABLE "tax_retentions" ADD CONSTRAINT "tax_retentions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_retentions" ADD CONSTRAINT "tax_retentions_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
