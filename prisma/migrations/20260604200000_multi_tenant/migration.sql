-- Multi-tenant: add storeId + admin fields to StoreUser, add lineName/lineOrIg to Customer

ALTER TABLE "StoreUser" ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE "StoreUser" ADD COLUMN IF NOT EXISTS "contactName" TEXT;
ALTER TABLE "StoreUser" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "StoreUser" ADD COLUMN IF NOT EXISTS "lineId" TEXT;
ALTER TABLE "StoreUser" ADD COLUMN IF NOT EXISTS "plan" TEXT;
ALTER TABLE "StoreUser" ADD COLUMN IF NOT EXISTS "expiryDate" TIMESTAMP(3);
ALTER TABLE "StoreUser" ADD COLUMN IF NOT EXISTS "notes" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StoreUser_storeId_fkey'
  ) THEN
    ALTER TABLE "StoreUser" ADD CONSTRAINT "StoreUser_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "lineName" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "lineOrIg" TEXT;

-- Link 2yuu to default-store
UPDATE "StoreUser" SET "storeId" = 'default-store' WHERE username = '2yuu' AND "storeId" IS NULL;

-- Create vivian store
INSERT INTO "Store" (id, name, "depositEnabled", "depositAmount", "createdAt", "updatedAt")
VALUES ('vivian-store', 'Vivian 美甲工作室', false, 0, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
