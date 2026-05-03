-- Crypto on-chain deposit / withdrawal rails + ledger transaction types

ALTER TYPE "TransactionType" ADD VALUE 'DEPOSIT_CRYPTO';
ALTER TYPE "TransactionType" ADD VALUE 'WITHDRAW_CRYPTO';

CREATE TYPE "ChainNetwork" AS ENUM ('TRC20', 'ERC20', 'BEP20');

CREATE TYPE "CryptoDepositIntentStatus" AS ENUM ('AWAITING_TX', 'PENDING_VALIDATION', 'CONFIRMED', 'FAILED');

CREATE TYPE "CryptoOnchainWithdrawalStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED');

CREATE TABLE "CryptoDepositIntent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "asset" "CryptoAsset" NOT NULL,
    "network" "ChainNetwork" NOT NULL,
    "platformAddress" TEXT NOT NULL,
    "memoTag" TEXT,
    "minAmount" DECIMAL(28,8) NOT NULL,
    "confirmationsRequired" INTEGER NOT NULL DEFAULT 12,
    "status" "CryptoDepositIntentStatus" NOT NULL DEFAULT 'AWAITING_TX',
    "riskWarningAcceptedAt" TIMESTAMP(3) NOT NULL,
    "userMarkedSentAt" TIMESTAMP(3),
    "txid" TEXT,
    "amountCredited" DECIMAL(28,8),
    "failureReason" TEXT,
    "explorerValidationJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CryptoDepositIntent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UsedOnchainTxid" (
    "id" UUID NOT NULL,
    "network" "ChainNetwork" NOT NULL,
    "txid" TEXT NOT NULL,
    "depositIntentId" UUID,
    "withdrawalId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsedOnchainTxid_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CryptoOnchainWithdrawal" (
    "id" UUID NOT NULL,
    "referenceId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "asset" "CryptoAsset" NOT NULL,
    "network" "ChainNetwork" NOT NULL,
    "toAddress" TEXT NOT NULL,
    "amount" DECIMAL(28,8) NOT NULL,
    "status" "CryptoOnchainWithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "cexOrderId" TEXT,
    "txid" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CryptoOnchainWithdrawal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CryptoOnchainWithdrawal_referenceId_key" ON "CryptoOnchainWithdrawal"("referenceId");

CREATE UNIQUE INDEX "UsedOnchainTxid_depositIntentId_key" ON "UsedOnchainTxid"("depositIntentId");

CREATE UNIQUE INDEX "UsedOnchainTxid_withdrawalId_key" ON "UsedOnchainTxid"("withdrawalId");

CREATE UNIQUE INDEX "UsedOnchainTxid_network_txid_key" ON "UsedOnchainTxid"("network", "txid");

CREATE INDEX "CryptoDepositIntent_userId_status_idx" ON "CryptoDepositIntent"("userId", "status");

CREATE INDEX "CryptoDepositIntent_userId_createdAt_idx" ON "CryptoDepositIntent"("userId", "createdAt");

CREATE INDEX "UsedOnchainTxid_txid_idx" ON "UsedOnchainTxid"("txid");

CREATE INDEX "CryptoOnchainWithdrawal_userId_status_idx" ON "CryptoOnchainWithdrawal"("userId", "status");

CREATE INDEX "CryptoOnchainWithdrawal_status_createdAt_idx" ON "CryptoOnchainWithdrawal"("status", "createdAt");

ALTER TABLE "CryptoDepositIntent" ADD CONSTRAINT "CryptoDepositIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CryptoOnchainWithdrawal" ADD CONSTRAINT "CryptoOnchainWithdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UsedOnchainTxid" ADD CONSTRAINT "UsedOnchainTxid_depositIntentId_fkey" FOREIGN KEY ("depositIntentId") REFERENCES "CryptoDepositIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UsedOnchainTxid" ADD CONSTRAINT "UsedOnchainTxid_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "CryptoOnchainWithdrawal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
