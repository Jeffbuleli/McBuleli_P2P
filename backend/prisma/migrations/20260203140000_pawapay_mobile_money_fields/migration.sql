-- AlterTable FiatDeposit
ALTER TABLE "FiatDeposit" ADD COLUMN "phoneNumber" TEXT;
ALTER TABLE "FiatDeposit" ADD COLUMN "correspondent" TEXT;
ALTER TABLE "FiatDeposit" ADD COLUMN "failureReason" TEXT;
ALTER TABLE "FiatDeposit" ADD COLUMN "lastWebhookAt" TIMESTAMP(3);

-- AlterTable FiatWithdrawal
ALTER TABLE "FiatWithdrawal" ADD COLUMN "correspondent" TEXT;
ALTER TABLE "FiatWithdrawal" ADD COLUMN "pawapayPayload" JSONB;
ALTER TABLE "FiatWithdrawal" ADD COLUMN "failureReason" TEXT;
ALTER TABLE "FiatWithdrawal" ADD COLUMN "lastWebhookAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "FiatDeposit_status_idx" ON "FiatDeposit"("status");
CREATE INDEX "FiatWithdrawal_status_idx" ON "FiatWithdrawal"("status");
