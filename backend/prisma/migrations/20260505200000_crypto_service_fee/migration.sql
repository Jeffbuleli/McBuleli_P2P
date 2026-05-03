-- USDT service fee for on-chain deposit (gross = net credit + fee) and withdraw (lock = net + fee).

ALTER TABLE "CryptoDepositIntent" ADD COLUMN "serviceFeeUsdt" DECIMAL(28,8) NOT NULL DEFAULT 2;

ALTER TABLE "CryptoOnchainWithdrawal" ADD COLUMN "feeAmount" DECIMAL(28,8) NOT NULL DEFAULT 2;
