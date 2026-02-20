/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `products` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "products" ADD COLUMN "images" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Migrate data
UPDATE "products" SET "images" = ARRAY["imageUrl"] WHERE "imageUrl" IS NOT NULL;

-- Drop column
ALTER TABLE "products" DROP COLUMN "imageUrl";
