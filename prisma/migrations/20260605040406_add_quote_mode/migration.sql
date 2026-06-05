-- CreateEnum
CREATE TYPE "QuoteMode" AS ENUM ('QUOTE_ONLY', 'QUOTE_HOLD');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "QuoteStatus" ADD VALUE 'CONFIRMED';
ALTER TYPE "QuoteStatus" ADD VALUE 'REJECTED';
ALTER TYPE "QuoteStatus" ADD VALUE 'EXPIRED';

-- DropForeignKey
ALTER TABLE "AppointmentService" DROP CONSTRAINT "AppointmentService_serviceId_fkey";

-- AlterTable
ALTER TABLE "AppointmentService" ALTER COLUMN "serviceId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "holdDate" DATE,
ADD COLUMN     "holdTime" TEXT,
ADD COLUMN     "holdUntil" TIMESTAMP(3),
ADD COLUMN     "quoteMode" "QuoteMode" NOT NULL DEFAULT 'QUOTE_ONLY';

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "quoteHoldHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "quoteMode" "QuoteMode" NOT NULL DEFAULT 'QUOTE_ONLY';

-- AddForeignKey
ALTER TABLE "AppointmentService" ADD CONSTRAINT "AppointmentService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
