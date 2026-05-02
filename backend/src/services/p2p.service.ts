import { P2POfferSide, WalletKind } from "../constants/schemaEnums.js";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../lib/prisma.js";
import { moveToLocked, refundLockedToSeller, releaseLockedToBuyer } from "./ledger.service.js";
import { newReference } from "../utils/refs.js";

const TRADE_MINUTES = 45;

export async function createOffer(
  userId: string,
  input: {
    side: P2POfferSide;
    cryptoAsset: "USDT" | "BTC";
    fiatCurrency: "USD" | "CDF" | "EUR";
    pricePerUnit: string;
    minFiat: string;
    maxFiat: string;
    paymentMethods: unknown[];
    expiresAt?: Date | null;
  },
) {
  return prisma.p2POffer.create({
    data: {
      userId,
      side: input.side,
      cryptoAsset: input.cryptoAsset,
      fiatCurrency: input.fiatCurrency,
      pricePerUnit: new Decimal(input.pricePerUnit),
      minFiat: new Decimal(input.minFiat),
      maxFiat: new Decimal(input.maxFiat),
      paymentMethods: input.paymentMethods as object[],
      status: "ACTIVE",
      expiresAt: input.expiresAt ?? null,
    },
  });
}

export async function listOffers(filters: {
  side?: P2POfferSide;
  fiat?: string;
  crypto?: string;
}) {
  return prisma.p2POffer.findMany({
    where: {
      status: "ACTIVE",
      ...(filters.side ? { side: filters.side } : {}),
      ...(filters.fiat ? { fiatCurrency: filters.fiat as "USD" | "CDF" | "EUR" } : {}),
      ...(filters.crypto ? { cryptoAsset: filters.crypto as "USDT" | "BTC" } : {}),
    },
    include: { user: { select: { id: true, username: true, p2pRatingAvg: true, completedTrades: true, createdAt: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function startTrade(
  offerId: string,
  takerId: string,
  fiatAmountStr: string,
) {
  const offer = await prisma.p2POffer.findUnique({
    where: { id: offerId },
    include: { user: true },
  });
  if (!offer || offer.status !== "ACTIVE") throw new Error("OFFER_UNAVAILABLE");
  if (offer.userId === takerId) throw new Error("SELF_TRADE");
  const cryptoCode = offer.cryptoAsset === "BTC" ? "BTC" : "USDT";
  const kind: WalletKind = "CRYPTO";

  const fiatAmount = new Decimal(fiatAmountStr);
  if (fiatAmount.lessThan(offer.minFiat) || fiatAmount.greaterThan(offer.maxFiat)) {
    throw new Error("AMOUNT_OUT_OF_RANGE");
  }
  const cryptoAmount = fiatAmount.div(offer.pricePerUnit);

  let buyerId: string;
  let sellerId: string;

  if (offer.side === "SELL") {
    sellerId = offer.userId;
    buyerId = takerId;
  } else {
    buyerId = offer.userId;
    sellerId = takerId;
  }

  const ref = newReference("P2P");
  const ends = new Date(Date.now() + TRADE_MINUTES * 60 * 1000);

  await moveToLocked(sellerId, kind, cryptoCode, cryptoAmount, "P2PTrade", ref);

  const trade = await prisma.p2PTrade.create({
    data: {
      referenceId: ref,
      offerId: offer.id,
      buyerId,
      sellerId,
      cryptoAmount,
      fiatAmount,
      status: "AWAITING_PAYMENT",
      timerEndsAt: ends,
    },
  });
  return trade;
}

export async function markPaid(tradeId: string, actorId: string) {
  const trade = await prisma.p2PTrade.findUnique({ where: { id: tradeId } });
  if (!trade) throw new Error("NOT_FOUND");
  if (trade.buyerId !== actorId) throw new Error("FORBIDDEN");
  if (trade.status !== "AWAITING_PAYMENT") throw new Error("INVALID_STATE");
  return prisma.p2PTrade.update({
    where: { id: tradeId },
    data: { status: "PAID", paidAt: new Date() },
  });
}

export async function confirmRelease(tradeId: string, actorId: string) {
  const trade = await prisma.p2PTrade.findUnique({
    where: { id: tradeId },
    include: { offer: true },
  });
  if (!trade) throw new Error("NOT_FOUND");
  if (trade.sellerId !== actorId) throw new Error("FORBIDDEN");
  if (trade.status !== "PAID") throw new Error("INVALID_STATE");
  const cryptoCode = cryptoCodeForTrade(trade.offer);

  await releaseLockedToBuyer(
    trade.sellerId,
    trade.buyerId,
    "CRYPTO",
    cryptoCode,
    trade.cryptoAmount,
    "P2PTrade",
    trade.id,
  );

  await prisma.$transaction([
    prisma.p2PTrade.update({
      where: { id: tradeId },
      data: { status: "COMPLETED", completedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: trade.buyerId },
      data: { completedTrades: { increment: 1 } },
    }),
    prisma.user.update({
      where: { id: trade.sellerId },
      data: { completedTrades: { increment: 1 } },
    }),
  ]);
  return prisma.p2PTrade.findUnique({ where: { id: tradeId } });
}

function cryptoCodeForTrade(offer: { cryptoAsset: "USDT" | "BTC" }): string {
  return offer.cryptoAsset === "BTC" ? "BTC" : "USDT";
}

export async function cancelTrade(tradeId: string, actorId: string) {
  const trade = await prisma.p2PTrade.findUnique({
    where: { id: tradeId },
    include: { offer: true },
  });
  if (!trade) throw new Error("NOT_FOUND");
  if (trade.buyerId !== actorId && trade.sellerId !== actorId) throw new Error("FORBIDDEN");
  if (trade.status === "COMPLETED" || trade.status === "CANCELLED") throw new Error("INVALID_STATE");
  if (trade.status === "PAID" || trade.status === "DISPUTED") {
    throw new Error("USE_DISPUTE_OR_SUPPORT");
  }
  const cryptoCode = cryptoCodeForTrade(trade.offer);
  await refundLockedToSeller(
    trade.sellerId,
    "CRYPTO",
    cryptoCode,
    trade.cryptoAmount,
    "P2PTrade",
    trade.id,
  );
  return prisma.p2PTrade.update({
    where: { id: tradeId },
    data: { status: "CANCELLED" },
  });
}

export async function autoCancelExpired(tradeId: string) {
  const trade = await prisma.p2PTrade.findUnique({
    where: { id: tradeId },
    include: { offer: true },
  });
  if (!trade || trade.status !== "AWAITING_PAYMENT") return null;
  const cryptoCode = cryptoCodeForTrade(trade.offer);
  await refundLockedToSeller(
    trade.sellerId,
    "CRYPTO",
    cryptoCode,
    trade.cryptoAmount,
    "P2PTrade",
    trade.id,
  );
  return prisma.p2PTrade.update({
    where: { id: tradeId },
    data: { status: "CANCELLED" },
  });
}

export async function openDispute(tradeId: string, openerId: string, reason: string) {
  const trade = await prisma.p2PTrade.findUnique({ where: { id: tradeId } });
  if (!trade) throw new Error("NOT_FOUND");
  if (trade.buyerId !== openerId && trade.sellerId !== openerId) throw new Error("FORBIDDEN");
  await prisma.$transaction([
    prisma.p2PTrade.update({ where: { id: tradeId }, data: { status: "DISPUTED" } }),
    prisma.p2PDispute.create({
      data: {
        tradeId,
        openedById: openerId,
        reason,
        status: "OPEN",
      },
    }),
  ]);
  return prisma.p2PTrade.findUnique({ where: { id: tradeId }, include: { dispute: true } });
}

export async function addTradeMessage(tradeId: string, senderId: string, body: string) {
  return prisma.p2PTradeMessage.create({
    data: { tradeId, senderId, body },
  });
}

export async function listTradeMessages(tradeId: string) {
  return prisma.p2PTradeMessage.findMany({
    where: { tradeId },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { username: true, id: true } } },
  });
}

export async function submitRating(tradeId: string, fromUserId: string, score: number, comment?: string) {
  const trade = await prisma.p2PTrade.findUnique({ where: { id: tradeId } });
  if (!trade || trade.status !== "COMPLETED") throw new Error("INVALID_TRADE");
  const toUserId = trade.buyerId === fromUserId ? trade.sellerId : trade.buyerId;
  await prisma.rating.create({
    data: {
      tradeId,
      fromUserId,
      toUserId,
      score,
      comment: comment ?? null,
    },
  });
  const agg = await prisma.rating.aggregate({
    where: { toUserId },
    _avg: { score: true },
    _count: { id: true },
  });
  await prisma.user.update({
    where: { id: toUserId },
    data: { p2pRatingAvg: agg._avg.score ?? 0 },
  });
}

/** Auto-cancel trades past timer */
export async function processExpiredTrades() {
  const now = new Date();
  const expired = await prisma.p2PTrade.findMany({
    where: {
      timerEndsAt: { lt: now },
      status: "AWAITING_PAYMENT",
    },
  });
  for (const t of expired) {
    try {
      await autoCancelExpired(t.id);
    } catch {
      /* ignore */
    }
  }
}
