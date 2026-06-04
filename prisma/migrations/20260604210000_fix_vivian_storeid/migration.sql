-- Fix vivian user storeId (seed's update:{} didn't set it if user already existed)

-- Ensure vivian-store exists
INSERT INTO "Store" (id, name, "depositEnabled", "depositAmount", "createdAt", "updatedAt")
VALUES ('vivian-store', 'Vivian 美甲工作室', false, 0, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Set vivian's storeId (regardless of whether it was null or wrong)
UPDATE "StoreUser" SET "storeId" = 'vivian-store' WHERE username = 'vivian';

-- Ensure 2yuu still has default-store
UPDATE "StoreUser" SET "storeId" = 'default-store' WHERE username = '2yuu';
