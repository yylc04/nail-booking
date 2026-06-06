-- Fix: ensure quoteHoldHours and quotePayHours are never 0
UPDATE "Store" SET "quoteHoldHours" = 24 WHERE "quoteHoldHours" = 0;
UPDATE "Store" SET "quotePayHours" = 24 WHERE "quotePayHours" = 0;
