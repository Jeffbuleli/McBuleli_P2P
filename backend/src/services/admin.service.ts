import { KycStatus, P2PDisputeStatus, TransactionType } from "../constants/schemaEnums.js";
import { prisma } from "../lib/prisma.js";
import {
  releaseLockedToBuyerTx,
  refundLockedToSellerTx,
  applyBalanceChange,
} from "./ledger.service.js";
function cryptoCodeFromAsset(a: "USDT" | "BTC") {
  return a === "BTC" ? "BTC" : "USDT";
}

export async function setKycStatus(
  userId: string,
  status: KycStatus,
  adminEmail: string,
) {
  await prisma.user.update({ where: { id: userId }, data: { kycStatus: status } });
  await prisma.adminAuditLog.create({
    data: {
      adminEmail,
      action: "KYC_UPDATE",
      targetType: "User",
      targetId: userId,
      metadata: { status },
    },
  });
}

export async function freezeUser(userId: string, adminEmail: string, frozen: boolean) {
  await prisma.user.update({ where: { id: userId }, data: { isFrozen: frozen } });
  await prisma.adminAuditLog.create({
    data: {
      adminEmail,
      action: frozen ? "FREEZE" : "UNFREEZE",
      targetType: "User",
      targetId: userId,
    },
  });
}

export async function listOpenDisputesForStaff() {
  return prisma.p2PDispute.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      openedBy: { select: { email: true, username: true } },
      trade: {
        select: {
          id: true,
          referenceId: true,
          status: true,
          cryptoAmount: true,
          fiatAmount: true,
          buyer: { select: { email: true, username: true } },
          seller: { select: { email: true, username: true } },
        },
      },
    },
  });
}

export async function resolveDispute(
  tradeId: string,
  resolution: P2PDisputeStatus,
  adminEmail: string,
) {
  const trade = await prisma.p2PTrade.findUnique({
    where: { id: tradeId },
    include: { offer: true, dispute: true },
  });
  if (!trade?.dispute || trade.dispute.status !== "OPEN") throw new Error("INVALID_DISPUTE");

  const cryptoCode = cryptoCodeFromAsset(trade.offer.cryptoAsset);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT id FROM "P2PTrade" WHERE id = $1::uuid FOR UPDATE`, tradeId);

    if (resolution === "RESOLVED_BUYER") {
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
      await tx.p2PTradeActivity.create({
        data: {
          tradeId,
          actorId: null,
          action: "DISPUTE_RESOLVED_BUYER",
          metadata: { adminEmail },
        },
      });
      await tx.user.update({
        where: { id: trade.buyerId },
        data: { completedTrades: { increment: 1 }, p2pTradesTotal: { increment: 1 } },
      });
      await tx.user.update({
        where: { id: trade.sellerId },
        data: { completedTrades: { increment: 1 }, p2pTradesTotal: { increment: 1 } },
      });
    } else if (resolution === "RESOLVED_SELLER") {
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
      await tx.p2PTradeActivity.create({
        data: {
          tradeId,
          actorId: null,
          action: "DISPUTE_RESOLVED_SELLER",
          metadata: { adminEmail },
        },
      });
      await tx.user.update({
        where: { id: trade.buyerId },
        data: { p2pTradesTotal: { increment: 1 } },
      });
      await tx.user.update({
        where: { id: trade.sellerId },
        data: { p2pTradesTotal: { increment: 1 } },
      });
    } else {
      throw new Error("INVALID_RESOLUTION");
    }

    await tx.p2PDispute.update({
      where: { tradeId },
      data: {
        status: resolution,
        resolvedAt: new Date(),
        resolution: adminEmail,
      },
    });
  });

  await prisma.adminAuditLog.create({
    data: {
      adminEmail,
      action: "DISPUTE_RESOLVE",
      targetType: "P2PTrade",
      targetId: tradeId,
      metadata: { resolution },
    },
  });
}

export async function approveWithdrawal(withdrawalId: string, adminEmail: string) {
  const w = await prisma.fiatWithdrawal.findUnique({ where: { id: withdrawalId } });
  if (!w || w.status !== "PENDING") throw new Error("INVALID_WITHDRAWAL");

  await prisma.fiatWithdrawal.update({
    where: { id: withdrawalId },
    data: { status: "SUCCESS", reviewedBy: adminEmail },
  });

  await prisma.adminAuditLog.create({
    data: {
      adminEmail,
      action: "WITHDRAW_APPROVE",
      targetType: "FiatWithdrawal",
      targetId: withdrawalId,
    },
  });

  return { ok: true };
}

export async function rejectWithdrawal(withdrawalId: string, adminEmail: string) {
  const w = await prisma.fiatWithdrawal.findUnique({ where: { id: withdrawalId } });
  if (!w || w.status !== "PENDING") throw new Error("INVALID_WITHDRAWAL");

  const cur = w.currency.toString();
  await applyBalanceChange(
    {
      userId: w.userId,
      kind: "FIAT",
      currencyCode: cur,
      amount: w.amount,
      type: "WITHDRAW_REJECT_REFUND",
      referenceType: "FiatWithdrawal",
      referenceId: withdrawalId,
    },
    TransactionType.ADJUSTMENT,
    "SUCCESS",
  );

  await prisma.fiatWithdrawal.update({
    where: { id: withdrawalId },
    data: { status: "FAILED", reviewedBy: adminEmail },
  });

  await prisma.adminAuditLog.create({
    data: {
      adminEmail,
      action: "WITHDRAW_REJECT",
      targetType: "FiatWithdrawal",
      targetId: withdrawalId,
    },
  });
}
