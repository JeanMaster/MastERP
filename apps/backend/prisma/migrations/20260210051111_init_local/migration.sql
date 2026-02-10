-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('PRODUCT', 'SERVICE', 'COMPOSED');

-- CreateEnum
CREATE TYPE "PaymentFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissions" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "hasWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT,
    "social1" TEXT,
    "social2" TEXT,
    "social3" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "rif" TEXT NOT NULL,
    "comercialName" TEXT NOT NULL,
    "legalName" TEXT,
    "contactName" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "category" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "invoiceNumber" TEXT,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "taxAmount" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'VES',
    "exchangeRate" DECIMAL(10,4) NOT NULL DEFAULT 1.0,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "dueDate" TIMESTAMP(3),
    "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "purchaseOrderId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate" TIMESTAMP(3),
    "subtotal" DECIMAL(10,2) NOT NULL,
    "taxAmount" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'VES',
    "exchangeRate" DECIMAL(10,4) NOT NULL DEFAULT 1.0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "cost" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_payments" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_items" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "cost" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "oldCost" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "subcategoryId" TEXT,
    "currencyId" TEXT NOT NULL,
    "type" "ProductType" NOT NULL DEFAULT 'PRODUCT',
    "costPrice" DECIMAL(10,2),
    "salePrice" DECIMAL(10,2) NOT NULL,
    "offerPrice" DECIMAL(10,2),
    "wholesalePrice" DECIMAL(10,2),
    "stock" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "unitId" TEXT,
    "secondaryUnitId" TEXT,
    "unitsPerSecondaryUnit" INTEGER,
    "conversionDirection" TEXT,
    "secondaryCostPrice" DECIMAL(10,2),
    "secondarySalePrice" DECIMAL(10,2),
    "secondaryOfferPrice" DECIMAL(10,2),
    "secondaryWholesalePrice" DECIMAL(10,2),
    "isReturnable" BOOLEAN NOT NULL DEFAULT true,
    "returnDeadlineDays" INTEGER,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductComponent" (
    "id" TEXT NOT NULL,
    "compositeProductId" TEXT NOT NULL,
    "componentProductId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_settings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rif" TEXT NOT NULL,
    "logoUrl" TEXT,
    "preferredSecondaryCurrencyId" TEXT,
    "autoUpdateRates" BOOLEAN NOT NULL DEFAULT false,
    "updateFrequency" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currencies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "exchangeRate" DECIMAL(10,4),
    "isAutomatic" BOOLEAN NOT NULL DEFAULT false,
    "apiSymbol" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceNumber" TEXT NOT NULL,
    "clientId" TEXT,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "tendered" DECIMAL(10,2),
    "change" DECIMAL(10,2),
    "exchangeRate" DECIMAL(10,4) NOT NULL DEFAULT 1.0,
    "hasReturns" BOOLEAN NOT NULL DEFAULT false,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "cashSessionId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_counters" (
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT 'FAC',
    "currentNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "saleId" TEXT,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3),
    "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(10,2) NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'VES',
    "exchangeRate" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "returns" (
    "id" TEXT NOT NULL,
    "originalSaleId" TEXT NOT NULL,
    "creditNoteNumber" TEXT NOT NULL,
    "returnType" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "productCondition" TEXT NOT NULL,
    "refundAmount" DECIMAL(10,2),
    "refundMethod" TEXT,
    "newSaleId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_items" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "restockQuantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_replacement_items" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "return_replacement_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_registers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_registers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_sessions" (
    "id" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "openedBy" TEXT NOT NULL,
    "closedBy" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "openingBalance" DECIMAL(10,2) NOT NULL,
    "openingNotes" TEXT,
    "expectedBalance" DECIMAL(10,2),
    "actualBalance" DECIMAL(10,2),
    "variance" DECIMAL(10,2),
    "closingNotes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_movements" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'VES',
    "saleId" TEXT,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "performedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_adjustments" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "previousStock" DECIMAL(10,3) NOT NULL,
    "newStock" DECIMAL(10,3) NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "performedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'VES',
    "exchangeRate" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "userId" TEXT,
    "cashMovementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "identification" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "position" TEXT NOT NULL,
    "department" TEXT,
    "baseSalary" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VES',
    "hireDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "paymentFrequency" "PaymentFrequency" NOT NULL DEFAULT 'BIWEEKLY',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_periods" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "paymentDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_payments" (
    "id" TEXT NOT NULL,
    "payrollPeriodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "baseSalary" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "exchangeRate" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "totalIncome" DECIMAL(10,2) NOT NULL,
    "totalDeductions" DECIMAL(10,2) NOT NULL,
    "netAmount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_payment_items" (
    "id" TEXT NOT NULL,
    "payrollPaymentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "payroll_payment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountType" TEXT NOT NULL DEFAULT 'CHECKING',
    "holderName" TEXT NOT NULL,
    "holderId" TEXT NOT NULL,
    "currencyId" TEXT NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_movements" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cashSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_rif_key" ON "suppliers"("rif");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_purchaseOrderId_key" ON "purchases"("purchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "ProductComponent_compositeProductId_componentProductId_key" ON "ProductComponent"("compositeProductId", "componentProductId");

-- CreateIndex
CREATE UNIQUE INDEX "units_name_key" ON "units"("name");

-- CreateIndex
CREATE UNIQUE INDEX "currencies_name_key" ON "currencies"("name");

-- CreateIndex
CREATE UNIQUE INDEX "currencies_code_key" ON "currencies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoiceNumber_key" ON "sales"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_saleId_key" ON "invoices"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "returns_creditNoteNumber_key" ON "returns"("creditNoteNumber");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_cashMovementId_key" ON "expenses"("cashMovementId");

-- CreateIndex
CREATE UNIQUE INDEX "employees_identification_key" ON "employees"("identification");

-- CreateIndex
CREATE UNIQUE INDEX "employees_userId_key" ON "employees"("userId");

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_secondaryUnitId_fkey" FOREIGN KEY ("secondaryUnitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductComponent" ADD CONSTRAINT "ProductComponent_compositeProductId_fkey" FOREIGN KEY ("compositeProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductComponent" ADD CONSTRAINT "ProductComponent_componentProductId_fkey" FOREIGN KEY ("componentProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_preferredSecondaryCurrencyId_fkey" FOREIGN KEY ("preferredSecondaryCurrencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "cash_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_originalSaleId_fkey" FOREIGN KEY ("originalSaleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_newSaleId_fkey" FOREIGN KEY ("newSaleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_replacement_items" ADD CONSTRAINT "return_replacement_items_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_replacement_items" ADD CONSTRAINT "return_replacement_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "cash_registers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "cash_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "payroll_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_payment_items" ADD CONSTRAINT "payroll_payment_items_payrollPaymentId_fkey" FOREIGN KEY ("payrollPaymentId") REFERENCES "payroll_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_movements" ADD CONSTRAINT "bank_movements_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_movements" ADD CONSTRAINT "bank_movements_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "cash_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
