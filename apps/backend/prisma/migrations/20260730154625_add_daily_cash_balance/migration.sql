-- CreateTable
CREATE TABLE "daily_cash_balances" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_cash_balances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_cash_balances_date_key" ON "daily_cash_balances"("date");

-- CreateIndex (was missing from the migration that added this column)
CREATE UNIQUE INDEX "inventory_adjustments_expenseId_key" ON "inventory_adjustments"("expenseId");
