-- Add deposit fields to Store
ALTER TABLE "Store" ADD COLUMN "depositEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Store" ADD COLUMN "depositAmount" INTEGER NOT NULL DEFAULT 0;

-- Remove old slot-generation columns from BusinessHour
ALTER TABLE "BusinessHour" DROP COLUMN IF EXISTS "openTime";
ALTER TABLE "BusinessHour" DROP COLUMN IF EXISTS "closeTime";
ALTER TABLE "BusinessHour" DROP COLUMN IF EXISTS "slotMinutes";

-- Remove openTime/closeTime from ExceptionDate (no longer needed)
ALTER TABLE "ExceptionDate" DROP COLUMN IF EXISTS "openTime";
ALTER TABLE "ExceptionDate" DROP COLUMN IF EXISTS "closeTime";

-- Create BusinessSlot table
CREATE TABLE "BusinessSlot" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "time" TEXT NOT NULL,
    CONSTRAINT "BusinessSlot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BusinessSlot_storeId_dayOfWeek_time_key" ON "BusinessSlot"("storeId", "dayOfWeek", "time");
ALTER TABLE "BusinessSlot" ADD CONSTRAINT "BusinessSlot_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create BankAccount table
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add transferCode to Appointment
ALTER TABLE "Appointment" ADD COLUMN "transferCode" TEXT;
