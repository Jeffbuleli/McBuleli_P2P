-- Align trade statuses with product naming (PENDING / RELEASED).
ALTER TYPE "P2PTradeStatus" RENAME VALUE 'AWAITING_PAYMENT' TO 'PENDING';
ALTER TYPE "P2PTradeStatus" RENAME VALUE 'COMPLETED' TO 'RELEASED';

ALTER TABLE "P2PTrade" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"P2PTradeStatus";

-- Denominator for success rate = completedTrades / max(1, p2pTradesTotal)
ALTER TABLE "User" ADD COLUMN "p2pTradesTotal" INTEGER NOT NULL DEFAULT 0;

UPDATE "User" SET "p2pTradesTotal" = GREATEST("completedTrades", "p2pTradesTotal");

CREATE TYPE "P2PActivityAction" AS ENUM (
  'TRADE_CREATED',
  'MARKED_PAID',
  'RELEASED',
  'CANCELLED',
  'DISPUTE_OPENED',
  'AUTO_EXPIRED',
  'DISPUTE_RESOLVED_BUYER',
  'DISPUTE_RESOLVED_SELLER'
);

CREATE TYPE "UserNotificationType" AS ENUM (
  'P2P_TRADE_NEW',
  'P2P_TRADE_PAID',
  'P2P_TRADE_RELEASED',
  'P2P_TRADE_CANCELLED',
  'P2P_DISPUTE_OPENED'
);

CREATE TABLE "P2PTradeActivity" (
    "id" UUID NOT NULL,
    "tradeId" UUID NOT NULL,
    "actorId" UUID,
    "action" "P2PActivityAction" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "P2PTradeActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "P2PTradeActivity_tradeId_createdAt_idx" ON "P2PTradeActivity"("tradeId", "createdAt");

ALTER TABLE "P2PTradeActivity" ADD CONSTRAINT "P2PTradeActivity_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "P2PTrade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "UserNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "P2PTrade_offerId_status_idx" ON "P2PTrade"("offerId", "status");
