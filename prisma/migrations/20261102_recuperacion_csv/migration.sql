-- AlterTable
ALTER TABLE "report_images" ADD COLUMN     "publicId" TEXT;

-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "whatsappFollowupConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappFollowupLastSentAt" TIMESTAMP(3),
ADD COLUMN     "whatsappFollowupReservedUntil" TIMESTAMP(3);

