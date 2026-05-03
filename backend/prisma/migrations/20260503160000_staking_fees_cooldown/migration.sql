-- AlterTable
ALTER TABLE "StakingPool" ADD COLUMN "rewardFeePercent" DECIMAL(8,4) NOT NULL DEFAULT 0;
ALTER TABLE "StakingPool" ADD COLUMN "cooldownSeconds" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "UserStake" ADD COLUMN "rewardFeePercentSnapshot" DECIMAL(8,4) NOT NULL DEFAULT 0;
