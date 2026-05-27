-- Create enum only if it does not already exist
DO $$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
      CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER', 'MANAGER', 'CASHIER', 'SELLER');
   END IF;
END $$;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role" USING "role"::text::"Role";
