-- Fix: rename Vivan → vivian, link to vivian-store, ensure STORE role

-- Ensure vivian-store exists
INSERT INTO "Store" (id, name, "depositEnabled", "depositAmount", "createdAt", "updatedAt")
VALUES ('vivian-store', 'Vivian 美甲工作室', false, 0, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Rename username Vivan → vivian and fix storeId + role in one statement
UPDATE "StoreUser"
SET username = 'vivian',
    "storeId" = 'vivian-store',
    "role"    = 'STORE'
WHERE username = 'Vivan';

-- Also handle any stale lowercase vivian row (idempotent safety)
UPDATE "StoreUser"
SET "storeId" = 'vivian-store',
    "role"    = 'STORE'
WHERE username = 'vivian' AND ("storeId" IS NULL OR "role" != 'STORE');
