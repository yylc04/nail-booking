-- Add booking release settings to Store
ALTER TABLE "Store"
  ADD COLUMN "bookingReleaseEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "bookingReleaseDay"     INTEGER NOT NULL DEFAULT 25,
  ADD COLUMN "bookingReleaseHour"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "bookingReleaseNote"    TEXT;
