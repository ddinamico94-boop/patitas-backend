-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "whatsappFollowupConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappFollowupLastSentAt" TIMESTAMP(3);
