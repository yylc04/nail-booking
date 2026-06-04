-- Fix vivian role: was SUPER_ADMIN, must be STORE
UPDATE "StoreUser" SET "role" = 'STORE' WHERE username = 'vivian';

-- Belt-and-suspenders: ensure vivian-store exists and is linked
INSERT INTO "Store" (id, name, "depositEnabled", "depositAmount", "createdAt", "updatedAt")
VALUES ('vivian-store', 'Vivian 美甲工作室', false, 0, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

UPDATE "StoreUser" SET "storeId" = 'vivian-store' WHERE username = 'vivian';
