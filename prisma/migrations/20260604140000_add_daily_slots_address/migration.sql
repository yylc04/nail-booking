-- Add address and bookingNotes to Store
ALTER TABLE "Store" ADD COLUMN "address" TEXT;
ALTER TABLE "Store" ADD COLUMN "bookingNotes" TEXT;

-- Create DailySlot table
CREATE TABLE "DailySlot" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "time" TEXT NOT NULL,
    CONSTRAINT "DailySlot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DailySlot_storeId_date_time_key" ON "DailySlot"("storeId", "date", "time");
ALTER TABLE "DailySlot" ADD CONSTRAINT "DailySlot_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
