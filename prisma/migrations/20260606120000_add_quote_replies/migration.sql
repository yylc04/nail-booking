-- Add quoteReplies column
ALTER TABLE "Quote" ADD COLUMN "quoteReplies" TEXT;

-- Migrate existing replyPrice/replyNote data into quoteReplies JSON array
UPDATE "Quote"
SET "quoteReplies" = json_build_array(
  json_build_object(
    'imageIndex', 0,
    'price', "replyPrice",
    'note', COALESCE("replyNote", '')
  )
)::text
WHERE "replyPrice" IS NOT NULL;

-- Drop old columns
ALTER TABLE "Quote" DROP COLUMN "replyPrice";
ALTER TABLE "Quote" DROP COLUMN "replyNote";
