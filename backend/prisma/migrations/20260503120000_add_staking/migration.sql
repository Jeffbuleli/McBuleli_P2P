-- CreateEnum
CREATE TYPE "StakeStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'STAKE_LOCK';
ALTER TYPE "TransactionType" ADD VALUE 'STAKE_EXIT';

-- CreateTable
CREATE TABLE "StakingPool" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "asset" "CryptoAsset" NOT NULL DEFAULT 'USDT',
    "nameFr" TEXT,
    "nameEn" TEXT,
    "apyAnnual" DECIMAL(12,6) NOT NULL,
    "lockDays" INTEGER NOT NULL,
    "minAmount" DECIMAL(28,8) NOT NULL,
    "maxStakePerUser" DECIMAL(28,8),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StakingPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStake" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "poolId" UUID NOT NULL,
    "amount" DECIMAL(28,8) NOT NULL,
    "apySnapshot" DECIMAL(12,6) NOT NULL,
    "lockDaysSnapshot" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maturesAt" TIMESTAMP(3) NOT NULL,
    "rewardAmount" DECIMAL(28,8),
    "status" "StakeStatus" NOT NULL DEFAULT 'ACTIVE',
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "UserStake_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StakingPool_slug_key" ON "StakingPool"("slug");

-- CreateIndex
CREATE INDEX "UserStake_userId_status_idx" ON "UserStake"("userId", "status");

-- CreateIndex
CREATE INDEX "UserStake_status_maturesAt_idx" ON "UserStake"("status", "maturesAt");

-- AddForeignKey
ALTER TABLE "UserStake" ADD CONSTRAINT "UserStake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStake" ADD CONSTRAINT "UserStake_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "StakingPool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
