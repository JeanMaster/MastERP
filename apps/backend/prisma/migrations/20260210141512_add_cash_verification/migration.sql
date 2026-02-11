-- AlterTable
ALTER TABLE "cash_sessions" ADD COLUMN     "verificationDiff" DECIMAL(10,2),
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedBy" TEXT;

-- CreateTable
CREATE TABLE "currency_denominations" (
    "id" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currency_denominations_pkey" PRIMARY KEY ("id")
);
