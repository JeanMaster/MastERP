-- CreateTable
CREATE TABLE "mercadolibre_accounts" (
    "id" TEXT NOT NULL,
    "mlUserId" TEXT NOT NULL,
    "username" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresIn" INTEGER NOT NULL,
    "scope" TEXT,
    "tokenType" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mercadolibre_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mercadolibre_product_mappings" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "mlItemId" TEXT NOT NULL,
    "mlPermalink" TEXT,
    "mlAccountId" TEXT NOT NULL,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSync" TIMESTAMP(3),
    "syncStatus" TEXT,
    "syncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mercadolibre_product_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mercadolibre_accounts_mlUserId_key" ON "mercadolibre_accounts"("mlUserId");

-- CreateIndex
CREATE UNIQUE INDEX "mercadolibre_product_mappings_productId_key" ON "mercadolibre_product_mappings"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "mercadolibre_product_mappings_mlItemId_key" ON "mercadolibre_product_mappings"("mlItemId");

-- AddForeignKey
ALTER TABLE "mercadolibre_product_mappings" ADD CONSTRAINT "mercadolibre_product_mappings_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mercadolibre_product_mappings" ADD CONSTRAINT "mercadolibre_product_mappings_mlAccountId_fkey" FOREIGN KEY ("mlAccountId") REFERENCES "mercadolibre_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
