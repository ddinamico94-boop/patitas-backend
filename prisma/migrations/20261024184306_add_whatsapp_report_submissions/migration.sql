-- CreateEnum
CREATE TYPE "WhatsappSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "whatsapp_report_submissions" (
    "id" TEXT NOT NULL,
    "whatsappPhone" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "originalResponses" JSONB NOT NULL,
    "animalDescription" TEXT,
    "locationDescription" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "status" "WhatsappSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_report_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_report_submissions_reportId_key" ON "whatsapp_report_submissions"("reportId");

-- CreateIndex
CREATE INDEX "whatsapp_report_submissions_status_createdAt_idx" ON "whatsapp_report_submissions"("status", "createdAt");

-- CreateIndex
CREATE INDEX "whatsapp_report_submissions_whatsappPhone_idx" ON "whatsapp_report_submissions"("whatsappPhone");
