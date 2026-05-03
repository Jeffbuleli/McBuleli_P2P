import { Prisma } from "@prisma/client";
import { P2POfferSide, WalletKind } from "../constants/schemaEnums.js";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../lib/prisma.js";
import {
  moveToLockedTx,
  refundLockedToSellerTx,
  releaseLockedToBuyerTx,
} from "./ledger.service.js";
import { newReference } from "../utils/refs.js";
import { createNotifications } from "./notification.service.js";

/** Payment window before auto-cancel (buyer must mark paid or trade expires). */
const TRADE_MINUTES = 15;

async function appendActivity(
  db: Prisma.TransactionClient,
  tradeId: string,
  actorId: string | null,
  action:
    | "TRADE_CREATED"
    | "MARKED_PAID"
    | "RELEASED"
    | "CANCELLED"
    | "DISPUTE_OPENED"
    | "AUTO_EXPIRED"
    | "DISPUTE_RESOLVED_BUYER"
    | "DISPUTE_RESOLVED_SELLER",
  metadata?: Prisma.InputJsonValue,
) {
  await db.p2PTradeActivity.create({
    data: {
      tradeId,
      actorId,
      action,
      metadata: metadata ?? undefined,
    },
  });
}

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
    include: {
      user: {
        select: {
          id: true,
          username: true,
          p2pRatingAvg: true,
          completedTrades: true,
          p2pTradesTotal: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function startTrade(offerId: string, takerId: string, fiatAmountStr: string) {
  const trade = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT id FROM "P2POffer" WHERE id = $1::uuid FOR UPDATE`,
        offerId,
      );

      const offer = await tx.p2POffer.findUnique({
        where: { id: offerId },
        include: { user: true },
      });
      if (!offer || offer.status !== "ACTIVE") throw new Error("OFFER_UNAVAILABLE");
      if (offer.userId === takerId) throw new Error("SELF_TRADE");
      if (offer.expiresAt && offer.expiresAt < new Date()) throw new Error("OFFER_EXPIRED");

      const duplicate = await tx.p2PTrade.findFirst({
        where: {
          offerId: offer.id,
          OR: [{ buyerId: takerId }, { sellerId: takerId }],
          status: { in: ["PENDING", "PAID", "DISPUTED"] },
        },
      });
      if (duplicate) throw new Error("DUPLICATE_ACTIVE_TRADE");

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

      await moveToLockedTx(tx, sellerId, kind, cryptoCode, cryptoAmount, "P2PTrade", ref);

      const created = await tx.p2PTrade.create({
        data: {
          referenceId: ref,
          offerId: offer.id,
          buyerId,
          sellerId,
          cryptoAmount,
          fiatAmount,
          status: "PENDING",
          timerEndsAt: ends,
        },
      });

      await appendActivity(tx, created.id, takerId, "TRADE_CREATED", {
        referenceId: ref,
        cryptoAmount: cryptoAmount.toString(),
        fiatAmount: fiatAmount.toString(),
      });

      return created;
    },
    { maxWait: 10_000, timeout: 30_000 },
  );

  await createNotifications([
    {
      userId: trade.buyerId,
      type: "P2P_TRADE_NEW",
      title: "New P2P trade",
      body: `Trade ${trade.referenceId} — send fiat off-platform, then mark paid.`,
      metadata: { tradeId: trade.id, referenceId: trade.referenceId },
    },
    {
      userId: trade.sellerId,
      type: "P2P_TRADE_NEW",
      title: "New P2P trade",
      body: `Trade ${trade.referenceId} — crypto is in escrow.`,
      metadata: { tradeId: trade.id, referenceId: trade.referenceId },
    },
  ]);

  return trade;
}

export async function markPaid(tradeId: string, actorId: string) {
  const trade = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT id FROM "P2PTrade" WHERE id = $1::uuid FOR UPDATE`, tradeId);
    const row = await tx.p2PTrade.findUnique({ where: { id: tradeId } });
    if (!row) throw new Error("NOT_FOUND");
    if (row.buyerId !== actorId) throw new Error("FORBIDDEN");
    if (row.status !== "PENDING") throw new Error("INVALID_STATE");
    const updated = await tx.p2PTrade.update({
      where: { id: tradeId },
      data: { status: "PAID", paidAt: new Date() },
    });
    await appendActivity(tx, tradeId, actorId, "MARKED_PAID", {});
    return updated;
  });

  await createNotifications([
    {
      userId: trade.sellerId,
      type: "P2P_TRADE_PAID",
      title: "Buyer marked paid",
      body: `Trade ${trade.referenceId} — confirm receipt of fiat to release crypto.`,
      metadata: { tradeId: trade.id, referenceId: trade.referenceId },
    },
  ]);

  return trade;
}

export async function confirmRelease(tradeId: string, actorId: string) {
  const done = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT id FROM "P2PTrade" WHERE id = $1::uuid FOR UPDATE`, tradeId);
    const trade = await tx.p2PTrade.findUnique({
      where: { id: tradeId },
      include: { offer: true },
    });
    if (!trade) throw new Error("NOT_FOUND");
    if (trade.sellerId !== actorId) throw new Error("FORBIDDEN");
    if (trade.status !== "PAID") throw new Error("INVALID_STATE");
    const cryptoCode = cryptoCodeForTrade(trade.offer);

    await releaseLockedToBuyerTx(
      tx,
      trade.sellerId,
      trade.buyerId,
      "CRYPTO",
      cryptoCode,
      trade.cryptoAmount,
      "P2PTrade",
      trade.id,
    );

    await tx.p2PTrade.update({
      where: { id: tradeId },
      data: { status: "RELEASED", completedAt: new Date() },
    });
    await appendActivity(tx, tradeId, actorId, "RELEASED", {});
    await tx.user.update({
      where: { id: trade.buyerId },
      data: {
        completedTrades: { increment: 1 },
        p2pTradesTotal: { increment: 1 },
      },
    });
    await tx.user.update({
      where: { id: trade.sellerId },
      data: {
        completedTrades: { increment: 1 },
        p2pTradesTotal: { increment: 1 },
      },
    });

    return tx.p2PTrade.findUnique({ where: { id: tradeId } });
  });

  const trade = await prisma.p2PTrade.findUniqueOrThrow({ where: { id: tradeId } });
  await createNotifications([
    {
      userId: trade.buyerId,
      type: "P2P_TRADE_RELEASED",
      title: "Trade completed",
      body: `Trade ${trade.referenceId} — crypto released to your wallet.`,
      metadata: { tradeId: trade.id, referenceId: trade.referenceId },
    },
    {
      userId: trade.sellerId,
      type: "P2P_TRADE_RELEASED",
      title: "Trade completed",
      body: `Trade ${trade.referenceId} — escrow released to buyer.`,
      metadata: { tradeId: trade.id, referenceId: trade.referenceId },
    },
  ]);

  return done;
}

function cryptoCodeForTrade(offer: { cryptoAsset: "USDT" | "BTC" }): string {
  return offer.cryptoAsset === "BTC" ? "BTC" : "USDT";
}

export async function cancelTrade(tradeId: string, actorId: string) {
  const updated = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT id FROM "P2PTrade" WHERE id = $1::uuid FOR UPDATE`, tradeId);
    const trade = await tx.p2PTrade.findUnique({
      where: { id: tradeId },
      include: { offer: true },
    });
    if (!trade) throw new Error("NOT_FOUND");
    if (trade.buyerId !== actorId && trade.sellerId !== actorId) throw new Error("FORBIDDEN");
    if (trade.status === "RELEASED" || trade.status === "CANCELLED") throw new Error("INVALID_STATE");
    if (trade.status === "PAID" || trade.status === "DISPUTED") {
      throw new Error("USE_DISPUTE_OR_SUPPORT");
    }
    const cryptoCode = cryptoCodeForTrade(trade.offer);
    await refundLockedToSellerTx(
      tx,
      trade.sellerId,
      "CRYPTO",
      cryptoCode,
      trade.cryptoAmount,
      "P2PTrade",
      trade.id,
    );

    await tx.p2PTrade.update({
      where: { id: tradeId },
      data: { status: "CANCELLED" },
    });
    await appendActivity(tx, tradeId, actorId, "CANCELLED", {});
    await tx.user.update({
      where: { id: trade.buyerId },
      data: { p2pTradesTotal: { increment: 1 } },
    });
    await tx.user.update({
      where: { id: trade.sellerId },
      data: { p2pTradesTotal: { increment: 1 } },
    });

    return tx.p2PTrade.findUnique({ where: { id: tradeId } });
  });

  const trade = await prisma.p2PTrade.findUniqueOrThrow({ where: { id: tradeId } });
  const peerId = actorId === trade.buyerId ? trade.sellerId : trade.buyerId;
  await createNotifications([
    {
      userId: peerId,
      type: "P2P_TRADE_CANCELLED",
      title: "Trade cancelled",
      body: `Trade ${trade.referenceId} was cancelled; escrow returned to seller.`,
      metadata: { tradeId: trade.id, referenceId: trade.referenceId },
    },
  ]);

  return updated;
}

export async function autoCancelExpired(tradeId: string) {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT id FROM "P2PTrade" WHERE id = $1::uuid FOR UPDATE`, tradeId);
    const trade = await tx.p2PTrade.findUnique({
      where: { id: tradeId },
      include: { offer: true },
    });
    if (!trade || trade.status !== "PENDING") return null;
    const cryptoCode = cryptoCodeForTrade(trade.offer);
    await refundLockedToSellerTx(
      tx,
      trade.sellerId,
      "CRYPTO",
      cryptoCode,
      trade.cryptoAmount,
      "P2PTrade",
      trade.id,
    );

    await tx.p2PTrade.update({
      where: { id: tradeId },
      data: { status: "CANCELLED" },
    });
    await appendActivity(tx, tradeId, null, "AUTO_EXPIRED", {});
    await tx.user.update({
      where: { id: trade.buyerId },
      data: { p2pTradesTotal: { increment: 1 } },
    });
    await tx.user.update({
      where: { id: trade.sellerId },
      data: { p2pTradesTotal: { increment: 1 } },
    });

    return trade;
  });

  if (!result) return null;

  await createNotifications([
    {
      userId: result.buyerId,
      type: "P2P_TRADE_CANCELLED",
      title: "Trade expired",
      body: `Trade ${result.referenceId} timed out before payment was marked.`,
      metadata: { tradeId: result.id, referenceId: result.referenceId },
    },
    {
      userId: result.sellerId,
      type: "P2P_TRADE_CANCELLED",
      title: "Trade expired",
      body: `Trade ${result.referenceId} expired; escrow returned.`,
      metadata: { tradeId: result.id, referenceId: result.referenceId },
    },
  ]);

  return prisma.p2PTrade.findUnique({ where: { id: tradeId } });
}

export async function openDispute(tradeId: string, openerId: string, reason: string) {
  const trade = await prisma.p2PTrade.findUnique({ where: { id: tradeId } });
  if (!trade) throw new Error("NOT_FOUND");
  if (trade.buyerId !== openerId && trade.sellerId !== openerId) throw new Error("FORBIDDEN");
  if (trade.status === "RELEASED" || trade.status === "CANCELLED") throw new Error("INVALID_STATE");
  if (trade.status === "DISPUTED") throw new Error("ALREADY_DISPUTED");

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
    prisma.p2PTradeActivity.create({
      data: {
        tradeId,
        actorId: openerId,
        action: "DISPUTE_OPENED",
        metadata: { reason },
      },
    }),
  ]);

  const peerId = openerId === trade.buyerId ? trade.sellerId : trade.buyerId;
  await createNotifications([
    {
      userId: peerId,
      type: "P2P_DISPUTE_OPENED",
      title: "Dispute opened",
      body: `Trade ${trade.referenceId} — support will review.`,
      metadata: { tradeId: trade.id, referenceId: trade.referenceId },
    },
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
  if (!trade || trade.status !== "RELEASED") throw new Error("INVALID_TRADE");
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

/** Auto-cancel trades past payment timer */
export async function processExpiredTrades() {
  const now = new Date();
  const expired = await prisma.p2PTrade.findMany({
    where: {
      timerEndsAt: { lt: now },
      status: "PENDING",
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
